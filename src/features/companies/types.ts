export interface Company {
  id: string
  name: string
  tax_id: string | null
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  industry: string | null
  size: string | null
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

export interface CompanyContact {
  job_title: string | null
  is_primary: boolean
  contacts: { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null }
}

export type CompanyInput = Pick<Company, 'name' | 'tax_id' | 'phone' | 'email' | 'website' | 'address' | 'industry' | 'size'>

export interface CompanyFormState {
  error?: string
  fields?: Partial<Record<keyof CompanyInput, string>>
  values?: CompanyInput
  success?: boolean
}
