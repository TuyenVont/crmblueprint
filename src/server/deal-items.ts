import 'server-only'
import { notFound } from 'next/navigation'
import { getAppContext } from '@/server/app-context'
import { isDealId } from '@/features/deals/validation'
import { isDealItemId, validateDealItemInput } from '@/features/deals/deal-items-validation'
import type { DealItem, DealItemFormState, DealItemRow, ProductOption } from '@/features/deals/deal-items-types'

export async function dealItemsContext(mode: 'read' | 'manage' = 'read') {
  const context = await getAppContext()
  if (mode === 'read' && !context.permissions.has('DEALS_VIEW')) {
    notFound()
  }
  if (mode === 'manage' && (!context.permissions.has('DEALS_MANAGE') || !context.permissions.has('DEALS_VIEW'))) {
    notFound()
  }
  return context
}

export async function getDealItems(dealId: string) {
  const context = await dealItemsContext('read')
  if (!isDealId(dealId)) notFound()

  const dealCheck = await context.supabase
    .from('deals')
    .select('id')
    .eq('workspace_id', context.workspaceId)
    .eq('id', dealId)
    .maybeSingle()

  if (dealCheck.error) throw new Error('Unable to load deal details. Please try again.')
  if (!dealCheck.data) notFound()

  const itemsResult = await context.supabase
    .from('deal_items')
    .select('*')
    .eq('workspace_id', context.workspaceId)
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true })
    .order('id')

  if (itemsResult.error) throw new Error('Unable to load deal items. Please try again.')
  const rows = (itemsResult.data || []) as DealItemRow[]

  let dealItems: DealItem[] = rows

  if (context.permissions.has('PRODUCTS_VIEW')) {
    const productIds = [...new Set(rows.map((item) => item.product_id).filter((id): id is string => !!id))]
    if (productIds.length) {
      const productsRes = await context.supabase
        .from('products')
        .select('id, image_url, sku')
        .eq('workspace_id', context.workspaceId)
        .in('id', productIds)

      if (productsRes.error) throw new Error('Unable to load product details for deal items.')

      const productMap = new Map<string, { image_url: string | null; sku: string | null }>()
      for (const p of productsRes.data || []) {
        productMap.set(p.id, { image_url: p.image_url, sku: p.sku })
      }

      dealItems = rows.map((row) => {
        const prod = row.product_id ? productMap.get(row.product_id) : null
        return {
          ...row,
          image_url: prod?.image_url || null,
          sku: prod?.sku || null,
        }
      })
    }
  }

  return {
    dealItems,
    canManage: context.permissions.has('DEALS_MANAGE'),
    canViewProducts: context.permissions.has('PRODUCTS_VIEW'),
  }
}

export async function getDealProductOptions(): Promise<ProductOption[]> {
  const context = await dealItemsContext('read')
  if (!context.permissions.has('PRODUCTS_VIEW')) return []

  const { data, error } = await context.supabase
    .from('products')
    .select('id, name, price, currency, sku, image_url')
    .eq('workspace_id', context.workspaceId)
    .eq('is_active', true)
    .order('name')
    .order('id')

  if (error) throw new Error('Unable to load product options. Please try again.')
  return (data || []) as ProductOption[]
}

export async function createDealItem(
  dealId: string,
  form: FormData
): Promise<DealItemFormState & { id?: string }> {
  const context = await dealItemsContext('manage')
  if (!isDealId(dealId)) return { error: 'Deal not found or unavailable.' }

  const dealCheck = await context.supabase
    .from('deals')
    .select('id')
    .eq('workspace_id', context.workspaceId)
    .eq('id', dealId)
    .maybeSingle()

  if (dealCheck.error || !dealCheck.data) return { error: 'Deal not found or unavailable.' }

  const { input, fields } = validateDealItemInput(form, true)
  if (Object.keys(fields || {}).length) {
    return { fields, values: input, error: 'Please correct the highlighted fields.' }
  }

  if (!context.permissions.has('PRODUCTS_VIEW')) {
    return { error: 'Product access is required to add products to a deal.' }
  }

  const productCheck = await context.supabase
    .from('products')
    .select('id, name, price')
    .eq('workspace_id', context.workspaceId)
    .eq('id', input.product_id!)
    .eq('is_active', true)
    .maybeSingle()

  if (productCheck.error || !productCheck.data) {
    return {
      fields: { product_id: 'Select an available active product.' },
      values: input,
      error: 'Please correct the highlighted fields.',
    }
  }

  const product = productCheck.data
  const finalPrice = form.has('price') && form.get('price') !== '' ? input.price : product.price

  const payload = {
    workspace_id: context.workspaceId,
    deal_id: dealId,
    product_id: product.id,
    name_snapshot: product.name,
    price: finalPrice,
    quantity: input.quantity,
    discount: input.discount,
    tax: input.tax,
  }

  const { data, error } = await context.supabase.from('deal_items').insert(payload).select('id').maybeSingle()

  if (error) {
    return { values: input, error: 'Unable to save deal item. Please try again.' }
  }
  if (!data) {
    return { values: input, error: 'Deal item not found or unavailable.' }
  }

  return { success: true, id: data.id }
}

export async function updateDealItem(
  dealItemId: string,
  form: FormData
): Promise<DealItemFormState & { id?: string }> {
  const context = await dealItemsContext('manage')
  if (!isDealItemId(dealItemId)) return { error: 'Deal item not found or unavailable.' }

  const currentItem = await context.supabase
    .from('deal_items')
    .select('id, deal_id, name_snapshot')
    .eq('workspace_id', context.workspaceId)
    .eq('id', dealItemId)
    .maybeSingle()

  if (currentItem.error || !currentItem.data) {
    return { error: 'Deal item not found or unavailable.' }
  }

  const { input, fields } = validateDealItemInput(form, false)
  if (Object.keys(fields || {}).length) {
    return { fields, values: input, error: 'Please correct the highlighted fields.' }
  }

  const payload = {
    price: input.price,
    quantity: input.quantity,
    discount: input.discount,
    tax: input.tax,
  }

  const { data, error } = await context.supabase
    .from('deal_items')
    .update(payload)
    .eq('workspace_id', context.workspaceId)
    .eq('id', dealItemId)
    .select('id')
    .maybeSingle()

  if (error) {
    return { values: input, error: 'Unable to save deal item. Please try again.' }
  }
  if (!data) {
    return { values: input, error: 'Deal item not found or unavailable.' }
  }

  return { success: true, id: data.id }
}

export async function deleteDealItem(dealItemId: string): Promise<{ success?: boolean; error?: string }> {
  const context = await dealItemsContext('manage')
  if (!isDealItemId(dealItemId)) return { error: 'Deal item not found or unavailable.' }

  const currentItem = await context.supabase
    .from('deal_items')
    .select('id')
    .eq('workspace_id', context.workspaceId)
    .eq('id', dealItemId)
    .maybeSingle()

  if (currentItem.error || !currentItem.data) {
    return { error: 'Deal item not found or unavailable.' }
  }

  const { error } = await context.supabase
    .from('deal_items')
    .delete()
    .eq('workspace_id', context.workspaceId)
    .eq('id', dealItemId)

  if (error) {
    return { error: 'Unable to delete deal item. Please try again.' }
  }

  return { success: true }
}
