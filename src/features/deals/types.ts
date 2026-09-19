export interface DealInput {
  name: string
  amount: string
  pipeline_id: string
  stage_id: string
  contact_id: string | null
  company_id: string | null
  expected_close_date: string | null
}

export interface DealRow extends DealInput {
  id: string
  currency: string
  created_at: string
  updated_at: string
}

export interface Deal extends DealRow {
  pipeline_name: string | null
  stage_name: string | null
  contact_name: string | null
  company_name: string | null
}

export interface DealFormDeal extends DealInput {
  id: string
  currency: string
}

export interface PipelineOption { id: string; name: string; is_default: boolean }
export interface StageOption { id: string; pipeline_id: string; name: string; position: number; type: 'OPEN' | 'WON' | 'LOST' }
export interface ContactOption { id: string; first_name: string; last_name: string | null }
export interface CompanyOption { id: string; name: string }

export interface DealFormOptions {
  pipelines: PipelineOption[]
  stages: StageOption[]
  contacts: ContactOption[]
  companies: CompanyOption[]
  canViewPipelines: boolean
  canViewContacts: boolean
  canViewCompanies: boolean
}

export interface DealFormState {
  error?: string
  fields?: Partial<Record<keyof DealInput, string>>
  values?: DealInput
  success?: boolean
}
