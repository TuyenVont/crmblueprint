export interface ContactInput {
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  birthday: string | null
  address: string | null
  notes: string | null
}

export interface Contact extends ContactInput {
  id: string
  owner_user_id: string | null
  source_id: string | null
  created_at: string
  updated_at: string
  companies: { id: string; name: string; job_title: string | null; is_primary: boolean }[]
}

export interface ContactFormState {
  error?: string
  fields?: Partial<Record<keyof ContactInput, string>>
  values?: ContactInput
}
