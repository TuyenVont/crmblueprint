import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)((name) => {
    if (!(name in imports)) throw Error(`Unexpected import ${name}`)
    return imports[name]
  }, exports)
  return exports
}

const workspace = '11111111-1111-1111-1111-111111111111'
const stageOpenId = '22222222-2222-2222-2222-222222222222'
const stageWonId = '33333333-3333-3333-3333-333333333333'
const stageLostId = '44444444-4444-4444-4444-444444444444'

const sampleStages = [
  { id: stageOpenId, pipeline_id: 'p1', name: 'Proposal', position: 1, type: 'OPEN' },
  { id: stageWonId, pipeline_id: 'p1', name: 'Won', position: 2, type: 'WON' },
  { id: stageLostId, pipeline_id: 'p1', name: 'Lost', position: 3, type: 'LOST' },
]

const sampleDeals = [
  { id: 'd1', name: 'Deal Open 1', amount: '1000000.00', currency: 'VND', stage_id: stageOpenId, company_id: null, created_at: '2026-01-02T00:00:00Z' },
  { id: 'd2', name: 'Deal Open 2', amount: '2000000.00', currency: 'VND', stage_id: stageOpenId, company_id: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'd3', name: 'Deal Won', amount: '5000000.00', currency: 'VND', stage_id: stageWonId, company_id: null, created_at: '2026-01-03T00:00:00Z' },
  { id: 'd4', name: 'Deal Lost', amount: '3000000.00', currency: 'VND', stage_id: stageLostId, company_id: null, created_at: '2026-01-04T00:00:00Z' },
]

function service(permissions = ['CONTACTS_VIEW', 'COMPANIES_VIEW', 'LEADS_VIEW', 'DEALS_VIEW', 'PIPELINES_VIEW'], customQueries = {}) {
  const calls = []
  const context = {
    workspaceId: workspace,
    permissions: new Set(permissions),
    supabase: {
      from: (table) => {
        calls.push(['from', table])
        const chain = {
          select: (...args) => {
            calls.push(['select', table, ...args])
            return chain
          },
          eq: (...args) => {
            calls.push(['eq', table, ...args])
            return chain
          },
          not: (...args) => {
            calls.push(['not', table, ...args])
            return chain
          },
          in: (...args) => {
            calls.push(['in', table, ...args])
            return chain
          },
          order: (...args) => {
            calls.push(['order', table, ...args])
            return chain
          },
          maybeSingle: async () => {
            calls.push(['maybeSingle', table])
            if (table === 'workspaces') return { data: { currency: 'VND' }, error: null }
            return { data: null, error: null }
          },
          then: (resolve) => {
            if (table === 'contacts') return Promise.resolve(customQueries.contacts || { count: 10, error: null }).then(resolve)
            if (table === 'companies') return Promise.resolve(customQueries.companies || { count: 5, error: null }).then(resolve)
            if (table === 'leads') return Promise.resolve(customQueries.leads || { count: 3, error: null }).then(resolve)
            if (table === 'stages') return Promise.resolve(customQueries.stages || { data: sampleStages, error: null }).then(resolve)
            if (table === 'deals') return Promise.resolve(customQueries.deals || { data: sampleDeals, error: null }).then(resolve)
            return Promise.resolve({ data: [], error: null }).then(resolve)
          },
        }
        return chain
      },
    },
  }

  const api = load('src/server/dashboard.ts', {
    'server-only': {},
    '@/server/app-context': { getAppContext: async () => context },
  })
  return { calls, ...api }
}

test('dashboard requires authenticated context and uses server-derived workspace_id', async () => {
  const s = service()
  const data = await s.getDashboardData()
  assert.ok(data.kpis)
  assert.ok(s.calls.filter((c) => c[0] === 'eq' && c[2] === 'workspace_id' && c[3] === workspace).length >= 4)
})

test('unauthenticated user is redirected to login', async () => {
  const appContext = load('src/server/app-context.ts', {
    'server-only': {},
    'next/navigation': { redirect: (path) => { throw Error(`REDIRECT ${path}`) } },
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: null } }) },
      }),
    },
  })
  const api = load('src/server/dashboard.ts', {
    'server-only': {},
    '@/server/app-context': appContext,
  })
  await assert.rejects(api.getDashboardData(), /REDIRECT \/login/)
})

test('module VIEW permissions are respected and missing permissions return null without querying DB', async () => {
  const sNoPerms = service([])
  const data = await sNoPerms.getDashboardData()
  assert.equal(data.kpis.totalContacts, null)
  assert.equal(data.kpis.totalCompanies, null)
  assert.equal(data.kpis.openLeads, null)
  assert.equal(data.kpis.openDeals, null)
  assert.equal(data.kpis.openPipelineValue, null)
  assert.deepEqual(sNoPerms.calls.filter((c) => c[0] === 'from').map((c) => c[1]), ['workspaces'])
})

test('open Deals and open Pipeline Value exclude terminal WON/LOST stages', async () => {
  const s = service()
  const data = await s.getDashboardData()
  // Deals in sampleDeals: Open 1 (1,000,000) + Open 2 (2,000,000) = 2 deals, total 3,000,000
  // WON (5,000,000) and LOST (3,000,000) must be excluded
  assert.equal(data.kpis.openDeals, 2)
  assert.equal(data.kpis.openPipelineValue, 3000000)

  const openStage = data.stagesBreakdown.find((st) => st.type === 'OPEN')
  const wonStage = data.stagesBreakdown.find((st) => st.type === 'WON')
  const lostStage = data.stagesBreakdown.find((st) => st.type === 'LOST')

  assert.equal(openStage.count, 2)
  assert.equal(openStage.totalValue, 3000000)
  assert.equal(wonStage.count, 1)
  assert.equal(wonStage.totalValue, 5000000)
  assert.equal(lostStage.count, 1)
  assert.equal(lostStage.totalValue, 3000000)
})

test('queries are strictly scoped to current workspace', async () => {
  const s = service()
  await s.getDashboardData()
  const eqWorkspaceCalls = s.calls.filter((c) => c[0] === 'eq' && c[2] === 'workspace_id' && c[3] === workspace)
  assert.ok(eqWorkspaceCalls.length >= 4)
  for (const call of eqWorkspaceCalls) {
    assert.equal(call[3], workspace)
  }
})
