import 'server-only'
import { notFound } from 'next/navigation'
import { getAppContext } from '@/server/app-context'
import { companySearchFilter, isCompanyId, validateCompany } from '@/features/companies/validation'
import type { Company, CompanyContact, CompanyFormState } from '@/features/companies/types'

const columns = 'id, name, tax_id, phone, email, website, address, industry, size, owner_user_id, created_at, updated_at'

export async function companiesContext(mode: 'read' | 'create' | 'edit' = 'read') {
  const context = await getAppContext()
  if ((mode !== 'create' && !context.permissions.has('COMPANIES_VIEW')) || (mode !== 'read' && !context.permissions.has('COMPANIES_MANAGE'))) notFound()
  return context
}

export async function getCompanies(page: number, search = '') {
  const context = await companiesContext()
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 200) throw new Error('Invalid search or page.')
  let query = context.supabase.from('companies').select(columns, { count: 'exact' }).eq('workspace_id', context.workspaceId)
  if (search.trim()) query = query.or(companySearchFilter(search.trim()))
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * 50, page * 50 - 1)
  if (error) throw new Error('Unable to load companies. Please try again.')
  return { companies: (data || []) as Company[], total: count || 0, canManage: context.permissions.has('COMPANIES_MANAGE') }
}

export async function getCompanyById(id: string, contactsPage = 1) {
  const context = await companiesContext()
  if (!isCompanyId(id)) notFound()
  if (!Number.isSafeInteger(contactsPage) || contactsPage < 1 || contactsPage > 100000) throw new Error('Invalid page.')
  const { data, error } = await context.supabase.from('companies').select(columns).eq('workspace_id', context.workspaceId).eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load company. Please try again.')
  if (!data) notFound()
  const canViewContacts = context.permissions.has('CONTACTS_VIEW')
  let contacts: CompanyContact[] = []
  let contactsTotal = 0
  if (canViewContacts) {
    const result = await context.supabase.from('company_contacts')
      .select('job_title, is_primary, contacts!company_contacts_contact_same_workspace_fk!inner(id, first_name, last_name, email, phone)', { count: 'exact' })
      .eq('workspace_id', context.workspaceId).eq('company_id', id)
      .order('created_at', { ascending: false }).order('id').range((contactsPage - 1) * 50, contactsPage * 50 - 1)
    if (result.error) throw new Error('Unable to load linked contacts. Please try again.')
    contacts = (result.data || []) as unknown as CompanyContact[]
    contactsTotal = result.count || 0
  }
  const canManageRelationships = ['COMPANIES_VIEW', 'CONTACTS_VIEW', 'COMPANIES_MANAGE', 'CONTACTS_MANAGE']
    .every(permission => context.permissions.has(permission))
  return { company: data as Company, canViewContacts, contacts, contactsTotal, canManage: context.permissions.has('COMPANIES_MANAGE'), canManageRelationships }
}

export async function getCompanyForEdit(id: string) {
  const { supabase, workspaceId } = await companiesContext('edit')
  if (!isCompanyId(id)) notFound()
  const { data, error } = await supabase.from('companies').select(columns).eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load company. Please try again.')
  if (!data) notFound()
  return data as Company
}

async function saveCompany(form: FormData, id?: string): Promise<CompanyFormState & { id?: string }> {
  const { supabase, workspaceId, permissions } = await companiesContext(id === undefined ? 'create' : 'edit')
  if (id !== undefined) {
    if (!isCompanyId(id)) return { error: 'Company not found or unavailable.' }
    // Check access before processing an edit; scope the subsequent UPDATE again
    // so membership/permission changes and concurrent deletion remain safe under RLS.
    const current = await supabase.from('companies').select('id').eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
    if (current.error) return { error: 'Unable to save company. Please try again.' }
    if (!current.data) return { error: 'Company not found or unavailable.' }
  }
  const { input, fields } = validateCompany(form)
  if (Object.keys(fields || {}).length) return { fields, values: input, error: 'Please correct the highlighted fields.' }
  // input is the validator's explicit eight-field allowlist, never the browser payload.
  // Ownership, IDs, timestamps and company_contacts are not accepted or mutated.
  const query = id === undefined
    ? supabase.from('companies').insert({ ...input, workspace_id: workspaceId })
    : supabase.from('companies').update(input).eq('workspace_id', workspaceId).eq('id', id)
  if (id === undefined && !permissions.has('COMPANIES_VIEW')) {
    // INSERT without RETURNING supports manage-only users without bypassing read RLS.
    const { error } = await query
    if (error) return { values: input, error: 'Unable to save company. Please try again.' }
    return { success: true }
  }
  const { data, error } = await query.select('id').maybeSingle()
  if (error) return { values: input, error: 'Unable to save company. Please try again.' }
  if (!data) return { values: input, error: 'Company not found or unavailable.' }
  return { id: data.id }
}

export const createCompany = (form: FormData) => saveCompany(form)
export const updateCompany = (id: string, form: FormData) => saveCompany(form, id)
