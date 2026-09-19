import type { LeadFormState, LeadInput, LeadStatus } from './types'

export const isLeadId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export const editableLeadStatuses = ['NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED'] as const

export function validateLead(form: FormData, options: { allowSource: boolean; currentStatus?: LeadStatus }): { input: LeadInput; fields: LeadFormState['fields'] } {
  const fields: NonNullable<LeadFormState['fields']> = {}
  const read = (key: keyof LeadInput, max: number) => {
    const raw = form.get(key)
    const value = typeof raw === 'string' ? raw.trim() : ''
    if ((raw !== null && typeof raw !== 'string') || value.length > max) fields[key] = `Use at most ${max} characters.`
    return value || null
  }
  const requestedStatus = read('status', 40)
  const status = options.currentStatus === 'CONVERTED' ? 'CONVERTED' : requestedStatus
  const sourceId = options.allowSource ? read('source_id', 36) : null
  const input: LeadInput = {
    first_name: read('first_name', 200) || '',
    last_name: read('last_name', 200),
    phone: read('phone', 80),
    email: read('email', 320),
    company_name: read('company_name', 200),
    source_id: sourceId,
    status: (status || 'NEW') as LeadStatus,
    notes: read('notes', 10000),
  }
  if (!input.first_name) fields.first_name = 'First name is required.'
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) fields.email = 'Enter a valid email address.'
  if (options.currentStatus !== 'CONVERTED' && (!requestedStatus || !editableLeadStatuses.includes(input.status as typeof editableLeadStatuses[number]))) fields.status = 'Select an available status.'
  if (input.source_id && !isLeadId(input.source_id)) fields.source_id = 'Select an available lead source.'
  return { input, fields }
}

// Match the Contacts/Companies literal substring escaping for PostgREST OR filters.
export function leadSearchFilter(search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`
  const quoted = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return ['first_name', 'last_name', 'email', 'phone', 'company_name']
    .map(field => `${field}.ilike.${quoted}`)
    .join(',')
}
