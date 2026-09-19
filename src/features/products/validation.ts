import type { ProductInput, ProductFormState } from './types'

export const isProductId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export function validateProduct(form: FormData): { input: ProductInput; fields: ProductFormState['fields'] } {
  const fields: NonNullable<ProductFormState['fields']> = {}
  const read = (key: keyof ProductInput, max: number) => {
    const raw = form.get(key)
    const value = typeof raw === 'string' ? raw.trim() : ''
    if ((raw !== null && typeof raw !== 'string') || value.length > max) fields[key] = `Use at most ${max} characters.`
    return value || null
  }

  const name = read('name', 200) || ''
  const sku = read('sku', 100)
  const unit = read('unit', 50)
  const price = read('price', 100) || ''
  const currency = read('currency', 10) || 'VND'
  const imageUrl = read('image_url', 2000)

  const isActiveRaw = form.get('is_active')
  let isActive = true
  if (isActiveRaw === 'false' || isActiveRaw === '0') {
    isActive = false
  } else if (isActiveRaw === 'true' || isActiveRaw === '1' || isActiveRaw === 'on') {
    isActive = true
  } else if (isActiveRaw === null) {
    // If form explicitly sent other fields but not is_active (e.g. unchecked checkbox)
    isActive = false
  }

  const input: ProductInput = {
    name,
    sku,
    unit,
    price,
    currency,
    image_url: imageUrl,
    is_active: isActive,
  }

  if (!name) fields.name = 'Product name is required.'
  if (!price || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(price)) fields.price = 'Enter a non-negative decimal value.'
  if (!currency) fields.currency = 'Currency is required.'

  if (imageUrl) {
    try {
      const url = new URL(imageUrl)
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
        throw new Error('Invalid URL')
      }
    } catch {
      fields.image_url = 'Enter a valid http:// or https:// image URL without credentials.'
    }
  }

  return { input, fields }
}

export function validateProductImage(file: File | null): { valid: boolean; error?: string } {
  if (!file || file.size === 0) return { valid: true }
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedMimeTypes.includes(file.type)) {
    return { valid: false, error: 'Please select a JPEG, PNG, or WebP image.' }
  }
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { valid: false, error: 'Image size must be at most 5 MB.' }
  }
  return { valid: true }
}

export function productSearchFilter(search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`
  const quoted = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return ['name', 'sku'].map(field => `${field}.ilike.${quoted}`).join(',')
}

