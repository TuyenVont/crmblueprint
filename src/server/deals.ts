import 'server-only'
import { notFound } from 'next/navigation'
import { getAppContext } from '@/server/app-context'
import { dealSearchFilter, isDealId, validateDeal } from '@/features/deals/validation'
import type { CompanyOption, ContactOption, Deal, DealFormDeal, DealFormOptions, DealFormState, DealRow, PipelineOption, StageOption } from '@/features/deals/types'

const columns = 'id, name, amount, currency, pipeline_id, stage_id, contact_id, company_id, expected_close_date, created_at, updated_at'

export async function dealsContext(mode: 'read' | 'create' | 'edit' = 'read') {
  const context = await getAppContext()
  if ((mode !== 'create' && !context.permissions.has('DEALS_VIEW')) || (mode !== 'read' && !context.permissions.has('DEALS_MANAGE'))) notFound()
  return context
}

async function withRelations(rows: DealRow[], context: Awaited<ReturnType<typeof dealsContext>>): Promise<Deal[]> {
  const pipelineNames = new Map<string, string>()
  const stageNames = new Map<string, string>()
  const contactNames = new Map<string, string>()
  const companyNames = new Map<string, string>()
  const ids = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => !!value))]
  if (context.permissions.has('PIPELINES_VIEW')) {
    const pipelineIds = ids(rows.map(row => row.pipeline_id))
    const stageIds = ids(rows.map(row => row.stage_id))
    const [pipelines, stages] = await Promise.all([
      pipelineIds.length ? context.supabase.from('pipelines').select('id, name').eq('workspace_id', context.workspaceId).in('id', pipelineIds).order('id') : Promise.resolve({ data: [], error: null }),
      stageIds.length ? context.supabase.from('stages').select('id, name').eq('workspace_id', context.workspaceId).in('id', stageIds).order('id') : Promise.resolve({ data: [], error: null }),
    ])
    if (pipelines.error || stages.error) throw new Error('Unable to load deal pipeline details. Please try again.')
    for (const row of pipelines.data || []) pipelineNames.set(row.id, row.name)
    for (const row of stages.data || []) stageNames.set(row.id, row.name)
  }
  if (context.permissions.has('CONTACTS_VIEW')) {
    const contactIds = ids(rows.map(row => row.contact_id))
    if (contactIds.length) {
      const result = await context.supabase.from('contacts').select('id, first_name, last_name').eq('workspace_id', context.workspaceId).in('id', contactIds).order('id')
      if (result.error) throw new Error('Unable to load related contacts. Please try again.')
      for (const row of result.data || []) contactNames.set(row.id, [row.first_name, row.last_name].filter(Boolean).join(' '))
    }
  }
  if (context.permissions.has('COMPANIES_VIEW')) {
    const companyIds = ids(rows.map(row => row.company_id))
    if (companyIds.length) {
      const result = await context.supabase.from('companies').select('id, name').eq('workspace_id', context.workspaceId).in('id', companyIds).order('id')
      if (result.error) throw new Error('Unable to load related companies. Please try again.')
      for (const row of result.data || []) companyNames.set(row.id, row.name)
    }
  }
  return rows.map((row) => ({
    ...row,
    pipeline_name: pipelineNames.get(row.pipeline_id) || null,
    stage_name: stageNames.get(row.stage_id) || null,
    contact_name: row.contact_id ? contactNames.get(row.contact_id) || null : null,
    company_name: row.company_id ? companyNames.get(row.company_id) || null : null,
  }))
}

export async function getDeals(page: number, search = '') {
  const context = await dealsContext()
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 200) throw new Error('Invalid search or page.')
  let query = context.supabase.from('deals').select(columns, { count: 'exact' }).eq('workspace_id', context.workspaceId)
  if (search.trim()) query = query.or(dealSearchFilter(search.trim()))
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * 50, page * 50 - 1)
  if (error) throw new Error('Unable to load deals. Please try again.')
  return {
    deals: await withRelations((data || []) as DealRow[], context), total: count || 0,
    canManage: context.permissions.has('DEALS_MANAGE'), canViewPipelines: context.permissions.has('PIPELINES_VIEW'),
    canViewContacts: context.permissions.has('CONTACTS_VIEW'), canViewCompanies: context.permissions.has('COMPANIES_VIEW'),
  }
}

export async function getDealById(id: string) {
  const context = await dealsContext()
  if (!isDealId(id)) notFound()
  const { data, error } = await context.supabase.from('deals').select(columns).eq('workspace_id', context.workspaceId).eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load deal. Please try again.')
  if (!data) notFound()
  return {
    deal: (await withRelations([data as DealRow], context))[0], canManage: context.permissions.has('DEALS_MANAGE'),
    canViewPipelines: context.permissions.has('PIPELINES_VIEW'), canViewContacts: context.permissions.has('CONTACTS_VIEW'), canViewCompanies: context.permissions.has('COMPANIES_VIEW'),
  }
}

async function getOptions(context: Awaited<ReturnType<typeof dealsContext>>): Promise<DealFormOptions> {
  const canViewPipelines = context.permissions.has('PIPELINES_VIEW')
  const canViewContacts = context.permissions.has('CONTACTS_VIEW')
  const canViewCompanies = context.permissions.has('COMPANIES_VIEW')
  const [pipelines, stages, contacts, companies] = await Promise.all([
    canViewPipelines ? context.supabase.from('pipelines').select('id, name, is_default').eq('workspace_id', context.workspaceId).order('is_default', { ascending: false }).order('name').order('id') : Promise.resolve({ data: [], error: null }),
    canViewPipelines ? context.supabase.from('stages').select('id, pipeline_id, name, position, type').eq('workspace_id', context.workspaceId).order('pipeline_id').order('position').order('id') : Promise.resolve({ data: [], error: null }),
    canViewContacts ? context.supabase.from('contacts').select('id, first_name, last_name').eq('workspace_id', context.workspaceId).order('created_at', { ascending: false }).order('id').limit(50) : Promise.resolve({ data: [], error: null }),
    canViewCompanies ? context.supabase.from('companies').select('id, name').eq('workspace_id', context.workspaceId).order('created_at', { ascending: false }).order('id').limit(50) : Promise.resolve({ data: [], error: null }),
  ])
  if (pipelines.error || stages.error || contacts.error || companies.error) throw new Error('Unable to load deal form options. Please try again.')
  return {
    pipelines: (pipelines.data || []) as PipelineOption[], stages: (stages.data || []) as StageOption[],
    contacts: (contacts.data || []) as ContactOption[], companies: (companies.data || []) as CompanyOption[],
    canViewPipelines, canViewContacts, canViewCompanies,
  }
}

async function workspaceCurrency(context: Awaited<ReturnType<typeof dealsContext>>) {
  const { data, error } = await context.supabase.from('workspaces').select('currency').eq('id', context.workspaceId).maybeSingle()
  if (error || !data?.currency) throw new Error('Unable to load workspace currency. Please try again.')
  return data.currency as string
}

export async function getDealCreateData() {
  const context = await dealsContext('create')
  return { options: await getOptions(context), currency: await workspaceCurrency(context), canViewDeals: context.permissions.has('DEALS_VIEW') }
}

export async function getDealForEdit(id: string) {
  const context = await dealsContext('edit')
  if (!isDealId(id)) notFound()
  const { data, error } = await context.supabase.from('deals').select('id, name, amount, currency, pipeline_id, stage_id, contact_id, company_id, expected_close_date').eq('workspace_id', context.workspaceId).eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load deal. Please try again.')
  if (!data) notFound()
  const options = await getOptions(context)
  if (options.canViewContacts && data.contact_id && !options.contacts.some(item => item.id === data.contact_id)) {
    const currentContact = await context.supabase.from('contacts').select('id, first_name, last_name').eq('workspace_id', context.workspaceId).eq('id', data.contact_id).maybeSingle()
    if (currentContact.error) throw new Error('Unable to load deal form options. Please try again.')
    if (currentContact.data) options.contacts.push(currentContact.data as ContactOption)
  }
  if (options.canViewCompanies && data.company_id && !options.companies.some(item => item.id === data.company_id)) {
    const currentCompany = await context.supabase.from('companies').select('id, name').eq('workspace_id', context.workspaceId).eq('id', data.company_id).maybeSingle()
    if (currentCompany.error) throw new Error('Unable to load deal form options. Please try again.')
    if (currentCompany.data) options.companies.push(currentCompany.data as CompanyOption)
  }
  const deal: DealFormDeal = {
    ...(data as DealFormDeal), pipeline_id: options.canViewPipelines ? data.pipeline_id : '', stage_id: options.canViewPipelines ? data.stage_id : '',
    contact_id: options.canViewContacts ? data.contact_id : null, company_id: options.canViewCompanies ? data.company_id : null,
  }
  return { deal, options }
}

async function saveDeal(form: FormData, id?: string): Promise<DealFormState & { id?: string }> {
  const context = await dealsContext(id === undefined ? 'create' : 'edit')
  let current: { currency: string; pipeline_id: string; stage_id: string; contact_id: string | null; company_id: string | null } | null = null
  if (id !== undefined) {
    if (!isDealId(id)) return { error: 'Deal not found or unavailable.' }
    const result = await context.supabase.from('deals').select('currency, pipeline_id, stage_id, contact_id, company_id').eq('workspace_id', context.workspaceId).eq('id', id).maybeSingle()
    if (result.error) return { error: 'Unable to save deal. Please try again.' }
    if (!result.data) return { error: 'Deal not found or unavailable.' }
    current = result.data
  }
  const permission = { pipeline: context.permissions.has('PIPELINES_VIEW'), contact: context.permissions.has('CONTACTS_VIEW'), company: context.permissions.has('COMPANIES_VIEW') }
  const { input, fields } = validateDeal(form, permission)
  if (!permission.pipeline && id === undefined) fields!.pipeline_id = 'Pipeline access is required to create a deal.'
  if (Object.keys(fields || {}).length) return { fields, values: input, error: 'Please correct the highlighted fields.' }

  let pipelineId = current?.pipeline_id || input.pipeline_id
  let stageId = current?.stage_id || input.stage_id
  if (permission.pipeline) {
    pipelineId = input.pipeline_id
    stageId = input.stage_id
    const [pipeline, stage] = await Promise.all([
      context.supabase.from('pipelines').select('id').eq('workspace_id', context.workspaceId).eq('id', pipelineId).maybeSingle(),
      context.supabase.from('stages').select('id').eq('workspace_id', context.workspaceId).eq('pipeline_id', pipelineId).eq('id', stageId).maybeSingle(),
    ])
    if (pipeline.error || !pipeline.data) return { fields: { pipeline_id: 'Select an available pipeline.' }, values: input, error: 'Please correct the highlighted fields.' }
    if (stage.error || !stage.data) return { fields: { stage_id: 'Select a stage from the selected pipeline.' }, values: input, error: 'Please correct the highlighted fields.' }
  }

  let contactId = current?.contact_id || null
  if (permission.contact) {
    contactId = input.contact_id
    if (contactId) {
      const related = await context.supabase.from('contacts').select('id').eq('workspace_id', context.workspaceId).eq('id', contactId).maybeSingle()
      if (related.error || !related.data) return { fields: { contact_id: 'Select an available contact.' }, values: input, error: 'Please correct the highlighted fields.' }
    }
  }
  let companyId = current?.company_id || null
  if (permission.company) {
    companyId = input.company_id
    if (companyId) {
      const related = await context.supabase.from('companies').select('id').eq('workspace_id', context.workspaceId).eq('id', companyId).maybeSingle()
      if (related.error || !related.data) return { fields: { company_id: 'Select an available company.' }, values: input, error: 'Please correct the highlighted fields.' }
    }
  }
  const currency = current?.currency || await workspaceCurrency(context)
  const payload = { name: input.name, amount: input.amount, currency, pipeline_id: pipelineId, stage_id: stageId, contact_id: contactId, company_id: companyId, expected_close_date: input.expected_close_date }
  const query = id === undefined
    ? context.supabase.from('deals').insert({ ...payload, workspace_id: context.workspaceId })
    : context.supabase.from('deals').update(payload).eq('workspace_id', context.workspaceId).eq('id', id)
  if (id === undefined && !context.permissions.has('DEALS_VIEW')) {
    const { error } = await query
    return error ? { values: input, error: 'Unable to save deal. Please try again.' } : { success: true }
  }
  const { data, error } = await query.select('id').maybeSingle()
  if (error) return { values: input, error: 'Unable to save deal. Please try again.' }
  if (!data) return { values: input, error: 'Deal not found or unavailable.' }
  return { id: data.id }
}

export const createDeal = (form: FormData) => saveDeal(form)
export const updateDeal = (id: string, form: FormData) => saveDeal(form, id)

export async function getDealsKanban(pipelineId?: string, search = '') {
  const context = await dealsContext()
  if (search.length > 200) throw new Error('Invalid search.')
  const canViewPipelines = context.permissions.has('PIPELINES_VIEW')
  let pipelines: PipelineOption[] = []
  if (canViewPipelines) {
    const pResult = await context.supabase.from('pipelines').select('id, name, is_default').eq('workspace_id', context.workspaceId).order('is_default', { ascending: false }).order('name').order('id')
    if (pResult.error) throw new Error('Unable to load pipelines. Please try again.')
    pipelines = (pResult.data || []) as PipelineOption[]
  }
  const activePipeline = pipelines.find(p => p.id === pipelineId) || pipelines.find(p => p.is_default) || pipelines[0] || null
  let stages: StageOption[] = []
  if (canViewPipelines && activePipeline) {
    const sResult = await context.supabase.from('stages').select('id, pipeline_id, name, position, type').eq('workspace_id', context.workspaceId).eq('pipeline_id', activePipeline.id).order('position').order('id')
    if (sResult.error) throw new Error('Unable to load stages. Please try again.')
    stages = (sResult.data || []) as StageOption[]
  }

  let deals: Deal[] = []
  if (activePipeline || !canViewPipelines) {
    let query = context.supabase.from('deals').select(columns).eq('workspace_id', context.workspaceId)
    if (activePipeline) {
      query = query.eq('pipeline_id', activePipeline.id)
    }
    if (search.trim()) {
      query = query.or(dealSearchFilter(search.trim()))
    }
    const { data, error } = await query.order('created_at', { ascending: false }).order('id').limit(500)
    if (error) throw new Error('Unable to load deals for Kanban. Please try again.')
    deals = await withRelations((data || []) as DealRow[], context)
  }

  return {
    deals,
    pipelines,
    activePipeline,
    stages,
    canManage: context.permissions.has('DEALS_MANAGE'),
    canViewPipelines,
    canViewContacts: context.permissions.has('CONTACTS_VIEW'),
    canViewCompanies: context.permissions.has('COMPANIES_VIEW'),
  }
}

export async function updateDealStage(dealId: string, stageId: string): Promise<{ success?: boolean; error?: string }> {
  const context = await dealsContext('edit')
  if (!isDealId(dealId) || !isDealId(stageId)) return { error: 'Invalid deal or stage ID.' }

  const targetDeal = await context.supabase.from('deals').select('id, pipeline_id, stage_id').eq('workspace_id', context.workspaceId).eq('id', dealId).maybeSingle()
  if (targetDeal.error || !targetDeal.data) return { error: 'Deal not found or unavailable.' }

  if (targetDeal.data.stage_id === stageId) return { success: true }

  if (context.permissions.has('PIPELINES_VIEW')) {
    const stageCheck = await context.supabase.from('stages').select('id').eq('workspace_id', context.workspaceId).eq('pipeline_id', targetDeal.data.pipeline_id).eq('id', stageId).maybeSingle()
    if (stageCheck.error || !stageCheck.data) return { error: 'Destination stage is invalid or does not belong to the active pipeline.' }
  }

  const updateResult = await context.supabase.from('deals').update({ stage_id: stageId }).eq('workspace_id', context.workspaceId).eq('id', dealId)
  if (updateResult.error) return { error: 'Unable to update deal stage. Please try again.' }

  return { success: true }
}

