export interface ProductInput {
  name: string
  sku: string | null
  unit: string | null
  price: string
  currency: string
  image_url: string | null
  is_active: boolean
}

export interface ProductRow extends ProductInput {
  id: string
  workspace_id: string
  created_at: string
  updated_at: string
}

export type Product = ProductRow

export interface ProductFormState {
  error?: string
  fields?: Partial<Record<keyof ProductInput, string>>
  values?: ProductInput
  success?: boolean
}
