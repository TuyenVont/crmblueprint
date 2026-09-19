import 'server-only'
import { notFound } from 'next/navigation'
import { getAppContext } from '@/server/app-context'
import { isLeadId, leadSearchFilter, validateLead } from '@/features/leads/validation'
import type { Lead, LeadFormLead, LeadFormState, LeadRow, LeadSourceOption } from '@/features/leads/types'

const columns = 'id, first_name, last_name, phone, email, company_name, source_id, status, notes, created_at, updated_at'

export async function leadsContext(mode: 'read' | 'create' | 'edit' = 'read') {
  const context = await getAppContext()
  if ((mode !== 'create' && !context.permissions.has('LEADS_VIEW')) || (mode !== 'read' && !context.permissions.has('LEADS_MANAGE'))) notFound()
  return context
}

async function withSources(rows: LeadRow[], context: Awaited<ReturnType<typeof leadsContext>>): Promise<Lead[]> {
  const sources = new Map<string, string>()
  const sourceIds = [...new Set(rows.flatMap(row => row.source_id ? [row.source_id] : []))]
  if (sourceIds.length && context.permissions.has('LEAD_SOURCES_VIEW')) {
    const { data, error } = await context.supabase.from('lead_sources').select('id, name')
      .eq('workspace_id', context.workspaceId).in('id', sourceIds).order('id')
    if (error) throw new Error('Unable to load lead sources. Please try again.')
    for (const source of data || []) sources.set(source.id, source.name)
  }
  return rows.map(({ source_id, ...lead }) => ({ ...lead, source_name: source_id ? sources.get(source_id) || null : null }))
}

export async function getLeads(page: number, search = '') {
  const context = await leadsContext()
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 200) throw new Error('Invalid search or page.')
  let query = context.supabase.from('leads').select(columns, { count: 'exact' }).eq('workspace_id', context.workspaceId)
  if (search.trim()) query = query.or(leadSearchFilter(search.trim()))
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * 50, page * 50 - 1)
  if (error) throw new Error('Unable to load leads. Please try again.')
  return {
    leads: await withSources((data || []) as LeadRow[], context),
    total: count || 0,
    canViewSources: context.permissions.has('LEAD_SOURCES_VIEW'),
    canManage: context.permissions.has('LEADS_MANAGE'),
  }
}

export async function getLeadById(id: string) {
  const context = await leadsContext()
  if (!isLeadId(id)) notFound()
  const { data, error } = await context.supabase.from('leads').select(columns)
    .eq('workspace_id', context.workspaceId).eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load lead. Please try again.')
  if (!data) notFound()
  return {
    lead: (await withSources([data as LeadRow], context))[0],
    canViewSources: context.permissions.has('LEAD_SOURCES_VIEW'),
    canManage: context.permissions.has('LEADS_MANAGE'),
  }
}

async function getLeadSources(context: Awaited<ReturnType<typeof leadsContext>>): Promise<LeadSourceOption[]> {
  if (!context.permissions.has('LEAD_SOURCES_VIEW')) return []
  const { data, error } = await context.supabase.from('lead_sources').select('id, name, is_active')
    .eq('workspace_id', context.workspaceId).order('name').order('id')
  if (error) throw new Error('Unable to load lead sources. Please try again.')
  return (data || []) as LeadSourceOption[]
}

export async function getLeadCreateData() {
  const context = await leadsContext('create')
  return { sources: await getLeadSources(context), canViewSources: context.permissions.has('LEAD_SOURCES_VIEW'), canViewLeads: context.permissions.has('LEADS_VIEW') }
}

export async function getLeadForEdit(id: string) {
  const context = await leadsContext('edit')
  if (!isLeadId(id)) notFound()
  const { data, error } = await context.supabase.from('leads').select('id, first_name, last_name, phone, email, company_name, source_id, status, notes')
    .eq('workspace_id', context.workspaceId).eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load lead. Please try again.')
  if (!data) notFound()
  const canViewSources = context.permissions.has('LEAD_SOURCES_VIEW')
  const lead = { ...data, source_id: canViewSources ? data.source_id : null } as LeadFormLead
  return { lead, sources: await getLeadSources(context), canViewSources }
}

async function saveLead(form: FormData, id?: string): Promise<LeadFormState & { id?: string }> {
  const context = await leadsContext(id === undefined ? 'create' : 'edit')
  let currentStatus: LeadFormLead['status'] | undefined
  let currentSourceId: string | null | undefined
  if (id !== undefined) {
    if (!isLeadId(id)) return { error: 'Lead not found or unavailable.' }
    const current = await context.supabase.from('leads').select('id, status, source_id').eq('workspace_id', context.workspaceId).eq('id', id).maybeSingle()
    if (current.error) return { error: 'Unable to save lead. Please try again.' }
    if (!current.data) return { error: 'Lead not found or unavailable.' }
    currentStatus = current.data.status as LeadFormLead['status']
    currentSourceId = current.data.source_id
  }
  const allowSource = context.permissions.has('LEAD_SOURCES_VIEW')
  const { input, fields } = validateLead(form, { allowSource, currentStatus })
  if (Object.keys(fields || {}).length) return { fields, values: input, error: 'Please correct the highlighted fields.' }
  if (allowSource && input.source_id) {
    const source = await context.supabase.from('lead_sources').select('id, is_active').eq('workspace_id', context.workspaceId).eq('id', input.source_id).maybeSingle()
    if (source.error || !source.data || (!source.data.is_active && currentSourceId !== input.source_id)) return { fields: { source_id: 'Select an available lead source.' }, values: input, error: 'Please correct the highlighted fields.' }
  }
  const editableFields = {
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone,
    email: input.email,
    company_name: input.company_name,
    status: input.status,
    notes: input.notes,
  }
  const payload = allowSource ? input : id === undefined ? { ...editableFields, source_id: null } : editableFields
  const query = id === undefined
    ? context.supabase.from('leads').insert({ ...payload, workspace_id: context.workspaceId })
    : context.supabase.from('leads').update(payload).eq('workspace_id', context.workspaceId).eq('id', id)
  if (id === undefined && !context.permissions.has('LEADS_VIEW')) {
    const { error } = await query
    if (error) return { values: input, error: 'Unable to save lead. Please try again.' }
    return { success: true }
  }
  const { data, error } = await query.select('id').maybeSingle()
  if (error) return { values: input, error: 'Unable to save lead. Please try again.' }
  if (!data) return { values: input, error: 'Lead not found or unavailable.' }
  return { id: data.id }
}

export const createLead = (form: FormData) => saveLead(form)
export const updateLead = (id: string, form: FormData) => saveLead(form, id)
