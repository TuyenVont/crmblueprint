import type { DealItemInput, DealItemFormState } from './deal-items-types'

export const isDealItemId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export function validateDealItemInput(
  form: FormData,
  isCreate = false
): { input: DealItemInput; fields: DealItemFormState['fields'] } {
  const fields: NonNullable<DealItemFormState['fields']> = {}

  const readStr = (key: keyof DealItemInput, max: number, defaultVal: string) => {
    const raw = form.get(key)
    if (raw !== null && typeof raw === 'string') {
      const val = raw.trim()
      if (val.length > max) {
        fields[key] = `Use at most ${max} characters.`
      }
      return val
    }
    return defaultVal
  }

  const productIdRaw = form.get('product_id')
  const productId = typeof productIdRaw === 'string' ? productIdRaw.trim() || null : null

  const quantityStr = readStr('quantity', 20, isCreate ? '1' : '')
  const priceStr = readStr('price', 20, '0')
  const discountStr = readStr('discount', 20, '0')
  const taxStr = readStr('tax', 20, '0')

  const input: DealItemInput = {
    product_id: productId,
    quantity: quantityStr,
    price: priceStr,
    discount: discountStr,
    tax: taxStr,
  }

  if (isCreate && !productId) {
    fields.product_id = 'Select an available product.'
  }

  const numRegex = /^(?:0|[1-9]\d*)(?:\.\d+)?$/

  if (!quantityStr || !numRegex.test(quantityStr)) {
    fields.quantity = 'Enter a valid positive quantity.'
  } else {
    const q = parseFloat(quantityStr)
    if (isNaN(q) || q <= 0) {
      fields.quantity = 'Quantity must be greater than 0.'
    }
  }

  if (!priceStr || !numRegex.test(priceStr)) {
    fields.price = 'Enter a non-negative decimal value.'
  } else {
    const p = parseFloat(priceStr)
    if (isNaN(p) || p < 0) {
      fields.price = 'Price must be non-negative.'
    }
  }

  if (!discountStr || !numRegex.test(discountStr)) {
    fields.discount = 'Enter a non-negative decimal value.'
  } else {
    const d = parseFloat(discountStr)
    if (isNaN(d) || d < 0) {
      fields.discount = 'Discount must be non-negative.'
    }
  }

  if (!taxStr || !numRegex.test(taxStr)) {
    fields.tax = 'Enter a non-negative decimal value.'
  } else {
    const t = parseFloat(taxStr)
    if (isNaN(t) || t < 0) {
      fields.tax = 'Tax must be non-negative.'
    }
  }

  if (!fields.quantity && !fields.price && !fields.discount) {
    const q = parseFloat(quantityStr)
    const p = parseFloat(priceStr)
    const d = parseFloat(discountStr)
    const subtotal = p * q
    if (d > subtotal) {
      fields.discount = `Discount (${d}) cannot exceed item subtotal (${subtotal}).`
    }
  }

  return { input, fields }
}
