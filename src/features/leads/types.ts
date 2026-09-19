export type LeadStatus = 'NEW' | 'ASSIGNED' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'UNQUALIFIED'

export interface LeadInput {
  first_name: string
  last_name: string | null
  phone: string | null
  email: string | null
  company_name: string | null
  source_id: string | null
  status: LeadStatus
  notes: string | null
}

export interface Lead extends Omit<LeadInput, 'source_id'> {
  id: string
  created_at: string
  updated_at: string
  source_name: string | null
}

export interface LeadRow extends Omit<Lead, 'source_name'> {
  source_id: string | null
}

export interface LeadFormLead extends LeadInput {
  id: string
}

export interface LeadSourceOption {
  id: string
  name: string
  is_active: boolean
}

export interface LeadFormState {
  error?: string
  fields?: Partial<Record<keyof LeadInput, string>>
  values?: LeadInput
  success?: boolean
}
