import type { DealFormState, DealInput } from './types'

export const isDealId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

function literalFilterValue(search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`
  return `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export const dealSearchFilter = (search: string) => `name.ilike.${literalFilterValue(search)}`

export function validateDeal(form: FormData, permissions: { pipeline: boolean; contact: boolean; company: boolean }): { input: DealInput; fields: DealFormState['fields'] } {
  const fields: NonNullable<DealFormState['fields']> = {}
  const read = (key: keyof DealInput, max: number) => {
    const raw = form.get(key)
    const value = typeof raw === 'string' ? raw.trim() : ''
    if ((raw !== null && typeof raw !== 'string') || value.length > max) fields[key] = `Use at most ${max} characters.`
    return value || null
  }
  const name = read('name', 200) || ''
  const amount = read('amount', 100) || ''
  const pipelineId = permissions.pipeline ? read('pipeline_id', 36) || '' : ''
  const stageId = permissions.pipeline ? read('stage_id', 36) || '' : ''
  const contactId = permissions.contact ? read('contact_id', 36) : null
  const companyId = permissions.company ? read('company_id', 36) : null
  const expectedCloseDate = read('expected_close_date', 10)
  const input: DealInput = { name, amount, pipeline_id: pipelineId, stage_id: stageId, contact_id: contactId, company_id: companyId, expected_close_date: expectedCloseDate }
  if (!name) fields.name = 'Deal name is required.'
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) fields.amount = 'Enter a non-negative decimal value.'
  if (permissions.pipeline && !isDealId(pipelineId)) fields.pipeline_id = 'Select an available pipeline.'
  if (permissions.pipeline && !isDealId(stageId)) fields.stage_id = 'Select an available stage.'
  if (contactId && !isDealId(contactId)) fields.contact_id = 'Select an available contact.'
  if (companyId && !isDealId(companyId)) fields.company_id = 'Select an available company.'
  if (expectedCloseDate && (!/^\d{4}-\d{2}-\d{2}$/.test(expectedCloseDate) || !Number.isFinite(Date.parse(expectedCloseDate)) || new Date(expectedCloseDate).toISOString().slice(0, 10) !== expectedCloseDate)) fields.expected_close_date = 'Enter a valid date.'
  return { input, fields }
}
