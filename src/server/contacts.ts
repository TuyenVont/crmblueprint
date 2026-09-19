import 'server-only'
import { notFound } from 'next/navigation'
import { getAppContext } from '@/server/app-context'
import { contactSearchFilter, isContactId, validateContact } from '@/features/contacts/validation'
import type { Contact, ContactFormState } from '@/features/contacts/types'

const columns = 'id, first_name, last_name, email, phone, birthday, address, notes, owner_user_id, source_id, created_at, updated_at'

export async function contactsContext(manage = false) {
  const context = await getAppContext()
  if (!context.permissions.has('CONTACTS_VIEW') || (manage && !context.permissions.has('CONTACTS_MANAGE'))) notFound()
  return context
}

async function withCompanies(rows: Omit<Contact, 'companies'>[], context: Awaited<ReturnType<typeof contactsContext>>): Promise<Contact[]> {
  const contacts = rows.map(row => ({ ...row, companies: [] as Contact['companies'] }))
  if (!rows.length || !context.permissions.has('COMPANIES_VIEW')) return contacts
  const { data, error } = await context.supabase.from('company_contacts')
    .select('contact_id, job_title, is_primary, companies!company_contacts_company_same_workspace_fk(id, name)')
    .eq('workspace_id', context.workspaceId).in('contact_id', rows.map(row => row.id)).order('id')
  if (error) throw new Error('Unable to load linked companies.')
  const links = data as unknown as { contact_id: string; job_title: string | null; is_primary: boolean; companies: { id: string; name: string } | null }[]
  for (const contact of contacts) contact.companies = links.filter(link => link.contact_id === contact.id && link.companies).map(link => ({ id: link.companies!.id, name: link.companies!.name, job_title: link.job_title, is_primary: link.is_primary }))
  return contacts
}

export async function getContacts(page: number, search = '') {
  const context = await contactsContext()
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 200) throw new Error('Invalid search or page.')
  let query = context.supabase.from('contacts').select(columns, { count: 'exact' }).eq('workspace_id', context.workspaceId)
  if (search.trim()) query = query.or(contactSearchFilter(search.trim()))
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * 50, page * 50 - 1)
  if (error) throw new Error('Unable to load contacts. Please try again.')
  return { contacts: await withCompanies(data || [], context), total: count || 0, page, search, canManage: context.permissions.has('CONTACTS_MANAGE'), canViewCompanies: context.permissions.has('COMPANIES_VIEW') }
}

export async function getContactById(id: string, manage = false) {
  const context = await contactsContext(manage)
  if (!isContactId(id)) notFound()
  const { data, error } = await context.supabase.from('contacts').select(columns).eq('workspace_id', context.workspaceId).eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load contact. Please try again.')
  if (!data) notFound()
  return { contact: (await withCompanies([data], context))[0], canManage: context.permissions.has('CONTACTS_MANAGE'), canViewCompanies: context.permissions.has('COMPANIES_VIEW') }
}

async function saveContact(form: FormData, id?: string): Promise<ContactFormState & { id?: string }> {
  const { supabase, workspaceId } = await contactsContext(true)
  if (id !== undefined && !isContactId(id)) return { error: 'Contact not found or unavailable.' }
  const { input, fields } = validateContact(form)
  if (Object.keys(fields || {}).length) return { fields, values: input, error: 'Please correct the highlighted fields.' }
  // Explicit allowlist: browser ownership, workspace, source and relation values are never copied.
  const query = id === undefined
    ? supabase.from('contacts').insert({ ...input, workspace_id: workspaceId })
    : supabase.from('contacts').update(input).eq('workspace_id', workspaceId).eq('id', id)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) return { values: input, error: 'Unable to save contact. Please try again.' }
  if (!data) return { values: input, error: 'Contact not found or unavailable.' }
  return { id: data.id }
}

export const createContact = (form: FormData) => saveContact(form)
export const updateContact = (id: string, form: FormData) => saveContact(form, id)
