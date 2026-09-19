import 'server-only'
import { notFound } from 'next/navigation'
import { getAppContext } from '@/server/app-context'
import { isProductId, productSearchFilter, validateProduct, validateProductImage } from '@/features/products/validation'
import type { Product, ProductFormState } from '@/features/products/types'

const columns = 'id, workspace_id, name, sku, unit, price, currency, image_url, is_active, created_at, updated_at'

export async function productsContext(mode: 'read' | 'create' | 'edit' = 'read') {
  const context = await getAppContext()
  if ((mode !== 'create' && !context.permissions.has('PRODUCTS_VIEW')) || (mode !== 'read' && !context.permissions.has('PRODUCTS_MANAGE'))) {
    notFound()
  }
  return context
}

export async function getProducts(page: number, search = '') {
  const context = await productsContext()
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 200) {
    throw new Error('Invalid search or page.')
  }
  let query = context.supabase.from('products').select(columns, { count: 'exact' }).eq('workspace_id', context.workspaceId)
  if (search.trim()) {
    query = query.or(productSearchFilter(search.trim()))
  }
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * 50, page * 50 - 1)
  if (error) throw new Error('Unable to load products. Please try again.')
  return { products: (data || []) as Product[], total: count || 0, canManage: context.permissions.has('PRODUCTS_MANAGE') }
}

export async function getProductById(id: string) {
  const context = await productsContext()
  if (!isProductId(id)) notFound()
  const { data, error } = await context.supabase.from('products').select(columns).eq('workspace_id', context.workspaceId).eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load product. Please try again.')
  if (!data) notFound()
  return { product: data as Product, canManage: context.permissions.has('PRODUCTS_MANAGE') }
}

export async function getProductForEdit(id: string) {
  const { supabase, workspaceId } = await productsContext('edit')
  if (!isProductId(id)) notFound()
  const { data, error } = await supabase.from('products').select(columns).eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load product. Please try again.')
  if (!data) notFound()
  return data as Product
}

async function saveProduct(form: FormData, id?: string): Promise<ProductFormState & { id?: string }> {
  const { supabase, workspaceId, permissions } = await productsContext(id === undefined ? 'create' : 'edit')
  let currentImageUrl: string | null = null
  if (id !== undefined) {
    if (!isProductId(id)) return { error: 'Product not found or unavailable.' }
    const current = await supabase.from('products').select('id, image_url').eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
    if (current.error) return { error: 'Unable to save product. Please try again.' }
    if (!current.data) return { error: 'Product not found or unavailable.' }
    currentImageUrl = current.data.image_url
  }

  const { input, fields } = validateProduct(form)

  // Handle uploaded image file
  const imageFile = form.get('image_file') as File | null
  const imageValidation = validateProductImage(imageFile)
  if (!imageValidation.valid) {
    return { fields: { ...fields, image_url: imageValidation.error }, values: input, error: 'Please correct the highlighted fields.' }
  }

  if (Object.keys(fields || {}).length) return { fields, values: input, error: 'Please correct the highlighted fields.' }

  let uploadedFilePath: string | null = null
  let uploadedPublicUrl: string | null = null

  const cleanupUploadedImage = async () => {
    if (!uploadedFilePath) return
    const { error } = await supabase.storage.from('product-images').remove([uploadedFilePath])
    if (error) {
      console.error('PRODUCT IMAGE CLEANUP ERROR:', { message: error.message, name: error.name })
    }
  }

  const cleanupReplacedImage = async () => {
    if (!uploadedFilePath || !uploadedPublicUrl || !currentImageUrl) return
    try {
      const newUrl = new URL(uploadedPublicUrl)
      const oldUrl = new URL(currentImageUrl)
      const pathPrefix = newUrl.pathname.slice(0, -uploadedFilePath.length)
      if (oldUrl.origin !== newUrl.origin || !oldUrl.pathname.startsWith(pathPrefix)) return
      const oldPath = decodeURIComponent(oldUrl.pathname.slice(pathPrefix.length))
      const ownedPath = new RegExp(`^${workspaceId}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpeg|png|webp)$`, 'i')
      if (!ownedPath.test(oldPath)) return
      const { error } = await supabase.storage.from('product-images').remove([oldPath])
      if (error) {
        console.error('PRODUCT IMAGE REPLACEMENT CLEANUP ERROR:', { message: error.message, name: error.name })
      }
    } catch {
      // External or malformed image URLs are never deletion targets.
    }
  }

  if (imageFile && imageFile.size > 0) {
    const ext = imageFile.type.split('/')[1] || 'png'
    const filePath = `${workspaceId}/${crypto.randomUUID()}.${ext}`

    if (supabase.storage?.from) {
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile, { contentType: imageFile.type, upsert: false, })

      if (uploadError) {
        console.error('PRODUCT IMAGE UPLOAD ERROR:', {
          message: uploadError.message,
          name: uploadError.name,
        })

        return {
          values: input,
          error: 'Unable to upload image. Please try again.'
        }
      }

      uploadedFilePath = filePath

      const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(filePath)
      if (publicUrlData?.publicUrl) {
        uploadedPublicUrl = publicUrlData.publicUrl
        input.image_url = publicUrlData.publicUrl
      }
    }
  } else if (id !== undefined && !input.image_url) {
    // Preserve existing image_url if no new image was uploaded and image_url wasn't explicitly cleared
    input.image_url = currentImageUrl
  }

  const query = id === undefined
    ? supabase.from('products').insert({ ...input, workspace_id: workspaceId })
    : supabase.from('products').update(input).eq('workspace_id', workspaceId).eq('id', id)

  if (id === undefined && !permissions.has('PRODUCTS_VIEW')) {
    const { error } = await query
    if (error) {
      await cleanupUploadedImage()
      if (error.code === '23505' || error.message?.toLowerCase().includes('sku') || error.message?.toLowerCase().includes('unique')) {
        return { fields: { sku: 'A product with this SKU already exists.' }, values: input, error: 'Please correct the highlighted fields.' }
      }
      return { values: input, error: 'Unable to save product. Please try again.' }
    }
    return { success: true }
  }

  const { data, error } = await query.select('id').maybeSingle()
  if (error) {
    await cleanupUploadedImage()
    if (error.code === '23505' || error.message?.toLowerCase().includes('sku') || error.message?.toLowerCase().includes('unique')) {
      return { fields: { sku: 'A product with this SKU already exists.' }, values: input, error: 'Please correct the highlighted fields.' }
    }
    return { values: input, error: 'Unable to save product. Please try again.' }
  }
  if (!data) {
    await cleanupUploadedImage()
    return { values: input, error: 'Product not found or unavailable.' }
  }
  await cleanupReplacedImage()
  return { id: data.id }
}

export const createProduct = (form: FormData) => saveProduct(form)
export const updateProduct = (id: string, form: FormData) => saveProduct(form, id)
