import 'server-only'
import { getAppContext } from '@/server/app-context'
import { isCompanyId } from '@/features/companies/validation'
import { contactSearchFilter, isContactId } from '@/features/contacts/validation'

const relationshipPermissions = ['COMPANIES_VIEW', 'CONTACTS_VIEW', 'COMPANIES_MANAGE', 'CONTACTS_MANAGE'] as const

export interface RelationshipActionState {
  error?: string
  success?: boolean
}

async function relationshipContext() {
  const context = await getAppContext()
  if (!relationshipPermissions.every(permission => context.permissions.has(permission))) {
    return null
  }
  return context
}

async function recordsAreAvailable(
  context: NonNullable<Awaited<ReturnType<typeof relationshipContext>>>,
  companyId: string,
  contactId: string,
) {
  const company = await context.supabase.from('companies').select('id').eq('workspace_id', context.workspaceId).eq('id', companyId).maybeSingle()
  if (company.error || !company.data) return false
  const contact = await context.supabase.from('contacts').select('id').eq('workspace_id', context.workspaceId).eq('id', contactId).maybeSingle()
  return !contact.error && !!contact.data
}

export async function searchContactsForCompany(companyId: string, page: number, search: string) {
  const context = await relationshipContext()
  if (!context || !isCompanyId(companyId)) return { contacts: [], total: 0, unavailable: true }
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 200) {
    return { contacts: [], total: 0, unavailable: true }
  }
  const company = await context.supabase.from('companies').select('id').eq('workspace_id', context.workspaceId).eq('id', companyId).maybeSingle()
  if (company.error || !company.data) return { contacts: [], total: 0, unavailable: true }
  let query = context.supabase.from('contacts')
    .select('id, first_name, last_name, email, phone', { count: 'exact' })
    .eq('workspace_id', context.workspaceId)
  if (search.trim()) query = query.or(contactSearchFilter(search.trim()))
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * 20, page * 20 - 1)
  if (error) return { contacts: [], total: 0, error: 'Unable to search contacts. Please try again.' }
  return { contacts: data || [], total: count || 0 }
}

export async function linkCompanyContact(companyId: string, contactId: string): Promise<RelationshipActionState> {
  const context = await relationshipContext()
  if (!context) return { error: 'You do not have permission to manage company contacts.' }
  if (!isCompanyId(companyId) || !isContactId(contactId) || !(await recordsAreAvailable(context, companyId, contactId))) {
    return { error: 'Company or contact not found or unavailable.' }
  }
  const { error } = await context.supabase.from('company_contacts').insert({
    workspace_id: context.workspaceId,
    company_id: companyId,
    contact_id: contactId,
  })
  if (error?.code === '23505') return { error: 'This contact is already linked to the company.' }
  if (error) return { error: 'Unable to link contact. Please try again.' }
  return { success: true }
}

export async function unlinkCompanyContact(companyId: string, contactId: string): Promise<RelationshipActionState> {
  const context = await relationshipContext()
  if (!context) return { error: 'You do not have permission to manage company contacts.' }
  if (!isCompanyId(companyId) || !isContactId(contactId) || !(await recordsAreAvailable(context, companyId, contactId))) {
    return { error: 'Company or contact not found or unavailable.' }
  }
  const link = await context.supabase.from('company_contacts').select('id')
    .eq('workspace_id', context.workspaceId).eq('company_id', companyId).eq('contact_id', contactId).maybeSingle()
  if (link.error || !link.data) return { error: 'Company or contact not found or unavailable.' }
  const { error } = await context.supabase.from('company_contacts').delete()
    .eq('workspace_id', context.workspaceId).eq('id', link.data.id)
  if (error) return { error: 'Unable to unlink contact. Please try again.' }
  return { success: true }
}
