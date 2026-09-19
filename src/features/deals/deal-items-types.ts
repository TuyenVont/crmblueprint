export interface DealItemInput {
  product_id?: string | null
  quantity: string
  price: string
  discount: string
  tax: string
}

export interface DealItemRow {
  id: string
  workspace_id: string
  deal_id: string
  product_id: string | null
  name_snapshot: string
  price: string
  quantity: string
  discount: string
  tax: string
  total: string
  created_at: string
  updated_at: string
}

export interface DealItem extends DealItemRow {
  image_url?: string | null
  sku?: string | null
}

export interface ProductOption {
  id: string
  name: string
  price: string
  currency: string
  sku: string | null
  image_url: string | null
}

export interface DealItemFormState {
  error?: string
  fields?: Partial<Record<keyof DealItemInput | 'product_id', string>>
  values?: Partial<DealItemInput>
  success?: boolean
}
