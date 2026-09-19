import 'server-only'
import { getAppContext } from '@/server/app-context'

export interface DashboardKPIs {
  totalContacts: number | null
  totalCompanies: number | null
  openLeads: number | null
  openDeals: number | null
  openPipelineValue: number | null
  currency: string
}

export interface StageBreakdownItem {
  id: string
  name: string
  type: 'OPEN' | 'WON' | 'LOST'
  count: number
  totalValue: number
}

export interface RecentDealItem {
  id: string
  name: string
  amount: string
  currency: string
  stage_name: string | null
  company_name: string | null
  created_at: string
}

export interface DashboardData {
  kpis: DashboardKPIs
  stagesBreakdown: StageBreakdownItem[]
  recentDeals: RecentDealItem[]
  permissions: {
    canViewContacts: boolean
    canViewCompanies: boolean
    canViewLeads: boolean
    canViewDeals: boolean
    canViewPipelines: boolean
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const context = await getAppContext()
  const canViewContacts = context.permissions.has('CONTACTS_VIEW')
  const canViewCompanies = context.permissions.has('COMPANIES_VIEW')
  const canViewLeads = context.permissions.has('LEADS_VIEW')
  const canViewDeals = context.permissions.has('DEALS_VIEW')
  const canViewPipelines = context.permissions.has('PIPELINES_VIEW')

  const wsRes = await context.supabase
    .from('workspaces')
    .select('currency')
    .eq('id', context.workspaceId)
    .maybeSingle()

  const currency = wsRes.data?.currency || 'USD'

  let totalContacts: number | null = null
  if (canViewContacts) {
    const { count, error } = await context.supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', context.workspaceId)
    if (error) throw new Error('Unable to load contacts count.')
    totalContacts = count || 0
  }

  let totalCompanies: number | null = null
  if (canViewCompanies) {
    const { count, error } = await context.supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', context.workspaceId)
    if (error) throw new Error('Unable to load companies count.')
    totalCompanies = count || 0
  }

  let openLeads: number | null = null
  if (canViewLeads) {
    const { count, error } = await context.supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', context.workspaceId)
      .not('status', 'in', '("QUALIFIED","UNQUALIFIED","CONVERTED")')
    if (error) throw new Error('Unable to load open leads count.')
    openLeads = count || 0
  }

  let openDeals: number | null = null
  let openPipelineValue: number | null = null
  let stagesBreakdown: StageBreakdownItem[] = []
  let recentDeals: RecentDealItem[] = []

  if (canViewDeals) {
    const stagesMap = new Map<string, { name: string; type: 'OPEN' | 'WON' | 'LOST'; position: number }>()
    const openStageIds = new Set<string>()

    if (canViewPipelines) {
      const stagesRes = await context.supabase
        .from('stages')
        .select('id, pipeline_id, name, position, type')
        .eq('workspace_id', context.workspaceId)
        .order('position')
        .order('id')

      if (stagesRes.error) throw new Error('Unable to load pipeline stages.')

      for (const st of stagesRes.data || []) {
        stagesMap.set(st.id, { name: st.name, type: st.type as 'OPEN' | 'WON' | 'LOST', position: st.position })
        if (st.type === 'OPEN') {
          openStageIds.add(st.id)
        }
      }
    }

    const dealsRes = await context.supabase
      .from('deals')
      .select('id, name, amount, currency, pipeline_id, stage_id, company_id, created_at')
      .eq('workspace_id', context.workspaceId)
      .order('created_at', { ascending: false })

    if (dealsRes.error) throw new Error('Unable to load deals data.')

    const allDeals = dealsRes.data || []

    const openDealsList = canViewPipelines
      ? allDeals.filter((d) => openStageIds.has(d.stage_id))
      : allDeals

    openDeals = openDealsList.length
    openPipelineValue = openDealsList.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)

    if (canViewPipelines && stagesMap.size > 0) {
      const breakdownMap = new Map<string, StageBreakdownItem>()
      for (const [id, st] of stagesMap.entries()) {
        breakdownMap.set(id, { id, name: st.name, type: st.type, count: 0, totalValue: 0 })
      }
      for (const d of allDeals) {
        const item = breakdownMap.get(d.stage_id)
        if (item) {
          item.count += 1
          item.totalValue += parseFloat(d.amount) || 0
        }
      }
      stagesBreakdown = Array.from(breakdownMap.values())
    }

    const topDeals = allDeals.slice(0, 5)

    const companyNamesMap = new Map<string, string>()
    if (canViewCompanies) {
      const companyIds = [...new Set(topDeals.map((d) => d.company_id).filter((cId): cId is string => !!cId))]
      if (companyIds.length) {
        const compRes = await context.supabase
          .from('companies')
          .select('id, name')
          .eq('workspace_id', context.workspaceId)
          .in('id', companyIds)
        if (!compRes.error) {
          for (const c of compRes.data || []) {
            companyNamesMap.set(c.id, c.name)
          }
        }
      }
    }

    recentDeals = topDeals.map((d) => ({
      id: d.id,
      name: d.name,
      amount: d.amount,
      currency: d.currency,
      stage_name: stagesMap.get(d.stage_id)?.name || null,
      company_name: d.company_id ? companyNamesMap.get(d.company_id) || null : null,
      created_at: d.created_at.slice(0, 10),
    }))
  }

  return {
    kpis: {
      totalContacts,
      totalCompanies,
      openLeads,
      openDeals,
      openPipelineValue,
      currency,
    },
    stagesBreakdown,
    recentDeals,
    permissions: {
      canViewContacts,
      canViewCompanies,
      canViewLeads,
      canViewDeals,
      canViewPipelines,
    },
  }
}
