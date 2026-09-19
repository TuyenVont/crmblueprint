import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('require', 'exports', code)(name => { if (!(name in imports)) throw Error(`Unexpected import ${name}`); return imports[name] }, exports)
  return exports
}

const validation = load('src/features/leads/validation.ts')
const workspace = '11111111-1111-1111-1111-111111111111'
const leadId = '22222222-2222-2222-2222-222222222222'
const sourceId = '33333333-3333-3333-3333-333333333333'
const lead = { id: leadId, first_name: 'Alice', last_name: 'Nguyen', email: 'alice@example.invalid', phone: '123', company_name: 'Acme', source_id: sourceId, status: 'NEW', notes: null, created_at: '2026-01-01', updated_at: '2026-01-01' }

function service(permissions = ['LEADS_VIEW'], results = [{ data: [lead], count: 1, error: null }]) {
  const calls = []
  let index = 0
  const context = { workspaceId: workspace, permissions: new Set(permissions), supabase: { from(table) {
    calls.push(['from', table])
    const result = results[index++]
    const chain = { then: resolve => Promise.resolve(result).then(resolve) }
    for (const method of ['select', 'eq', 'in', 'order', 'range', 'or', 'maybeSingle', 'insert', 'update']) chain[method] = (...args) => { calls.push([method, ...args]); return chain }
    return chain
  } } }
  const api = load('src/server/leads.ts', {
    'server-only': {},
    'next/navigation': { notFound: () => { throw Error('NOT_FOUND') } },
    '@/server/app-context': { getAppContext: async () => context },
    '@/features/leads/validation': validation,
  })
  return { ...api, calls }
}

test('LEADS_VIEW is required before list or detail queries, including for manage-only users', async () => {
  for (const permissions of [[], ['LEADS_MANAGE'], ['LEAD_SOURCES_VIEW']]) {
    const s = service(permissions)
    await assert.rejects(s.getLeads(1), /NOT_FOUND/)
    await assert.rejects(s.getLeadById(leadId), /NOT_FOUND/)
    assert.equal(s.calls.length, 0)
  }
})

test('authorized list uses exact count, literal search, workspace scope and stable 50-row pagination', async () => {
  const s = service(['LEADS_VIEW'], [{ data: [lead], count: 70, error: null }])
  const data = await s.getLeads(2, ' Alice%_ ')
  assert.equal(data.total, 70)
  assert.equal(data.leads[0].source_name, null)
  assert.ok(!Object.hasOwn(data.leads[0], 'source_id'))
  for (const expected of [['eq', 'workspace_id', workspace], ['range', 50, 99], ['order', 'created_at', { ascending: false }], ['order', 'id']]) {
    assert.ok(s.calls.some(call => JSON.stringify(call) === JSON.stringify(expected)))
  }
  assert.ok(s.calls.some(call => call[0] === 'select' && call[2]?.count === 'exact'))
  assert.ok(s.calls.some(call => call[0] === 'or' && call[1].includes('company_name.ilike') && call[1].includes('\\\\%') && call[1].includes('\\\\_')))
})

test('lead sources are queried separately only with source view permission and remain workspace scoped', async () => {
  const hidden = service(['LEADS_VIEW'], [{ data: [lead], count: 1, error: null }])
  assert.equal((await hidden.getLeads(1)).leads[0].source_name, null)
  assert.deepEqual(hidden.calls.filter(call => call[0] === 'from'), [['from', 'leads']])

  const visible = service(['LEADS_VIEW', 'LEAD_SOURCES_VIEW'], [
    { data: [lead], count: 1, error: null },
    { data: [{ id: sourceId, name: 'Referral' }], error: null },
  ])
  assert.equal((await visible.getLeads(1)).leads[0].source_name, 'Referral')
  assert.deepEqual(visible.calls.filter(call => call[0] === 'from'), [['from', 'leads'], ['from', 'lead_sources']])
  assert.ok(visible.calls.some(call => call[0] === 'eq' && call[1] === 'workspace_id' && call[2] === workspace))
  assert.ok(visible.calls.some(call => call[0] === 'in' && call[1] === 'id' && call[2][0] === sourceId))
})

test('authorized detail is scoped to workspace and resolves a permitted source', async () => {
  const s = service(['LEADS_VIEW', 'LEAD_SOURCES_VIEW'], [
    { data: lead, error: null },
    { data: [{ id: sourceId, name: 'Website' }], error: null },
  ])
  const data = await s.getLeadById(leadId)
  assert.equal(data.lead.id, leadId)
  assert.equal(data.lead.source_name, 'Website')
  assert.ok(s.calls.some(call => call[0] === 'eq' && call[1] === 'workspace_id' && call[2] === workspace))
  assert.ok(s.calls.some(call => call[0] === 'eq' && call[1] === 'id' && call[2] === leadId))
})

test('foreign, missing and malformed lead IDs reveal no existence information', async () => {
  for (const id of [leadId, '44444444-4444-4444-4444-444444444444']) {
    const s = service(undefined, [{ data: null, error: null }])
    await assert.rejects(s.getLeadById(id), /NOT_FOUND/)
    assert.ok(s.calls.some(call => call[0] === 'eq' && call[1] === 'workspace_id' && call[2] === workspace))
  }
  const malformed = service()
  await assert.rejects(malformed.getLeadById('bad-id'), /NOT_FOUND/)
  assert.equal(malformed.calls.length, 0)
})

test('anonymous users redirect before any lead query', async () => {
  const appContext = load('src/server/app-context.ts', {
    'server-only': {},
    'next/navigation': { redirect: path => { throw Error(`REDIRECT ${path}`) } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) }, from: () => { throw Error('Unexpected query') } }) },
  })
  const api = load('src/server/leads.ts', {
    'server-only': {}, 'next/navigation': { notFound: () => { throw Error('NOT_FOUND') } },
    '@/server/app-context': appContext, '@/features/leads/validation': validation,
  })
  await assert.rejects(api.getLeads(1), /REDIRECT \/login/)
  await assert.rejects(api.getLeadById(leadId), /REDIRECT \/login/)
})

test('invalid input and database failures expose only friendly errors', async () => {
  const s = service()
  for (const page of [0, -1, 1.5, NaN, Infinity, 100001]) await assert.rejects(s.getLeads(page), /Invalid/)
  await assert.rejects(s.getLeads(1, 'x'.repeat(201)), /Invalid/)
  assert.equal(s.calls.length, 0)
  const raw = { message: 'foreign workspace SQL secret' }
  await assert.rejects(service(undefined, [{ error: raw }]).getLeads(1), { message: 'Unable to load leads. Please try again.' })
  await assert.rejects(service(undefined, [{ error: raw }]).getLeadById(leadId), { message: 'Unable to load lead. Please try again.' })
  await assert.rejects(service(['LEADS_VIEW', 'LEAD_SOURCES_VIEW'], [{ data: lead }, { error: raw }]).getLeadById(leadId), { message: 'Unable to load lead sources. Please try again.' })
})

test('lead search safely quotes PostgREST filter syntax', () => {
  const filter = validation.leadSearchFilter('hello),id.eq.secret%,_"\\')
  assert.ok(filter.includes('first_name.ilike."%'))
  assert.ok(filter.includes('\\\\%')); assert.ok(filter.includes('\\\\_')); assert.ok(filter.includes('\\"'))
  for (const field of ['first_name', 'last_name', 'email', 'phone', 'company_name']) assert.ok(filter.includes(`${field}.ilike`))
})

test('lead navigation requires LEADS_VIEW rather than a role name or manage permission', () => {
  const { filterNavigation } = load('src/components/app-shell/navigation.ts')
  assert.ok(filterNavigation(new Set(['LEADS_VIEW'])).mainItems.some(item => item.href === '/app/leads'))
  assert.ok(!filterNavigation(new Set(['LEADS_MANAGE'])).mainItems.some(item => item.href === '/app/leads'))
})

function leadForm(status = 'NEW') {
  const form = new FormData()
  form.set('first_name', ' Alice ')
  form.set('last_name', ' Nguyen ')
  form.set('email', ' alice@example.invalid ')
  form.set('phone', ' 123 ')
  form.set('company_name', ' Acme ')
  form.set('status', status)
  form.set('notes', ' Note ')
  return form
}

test('authorized manage-only user creates with server workspace and no forbidden RETURNING', async () => {
  const form = leadForm()
  for (const key of ['id', 'workspace_id', 'owner_user_id', 'converted_at', 'converted_contact_id', 'converted_company_id', 'converted_deal_id', 'created_at', 'updated_at']) form.set(key, 'forged')
  form.set('source_id', sourceId)
  const s = service(['LEADS_MANAGE'], [{ error: null }])
  assert.deepEqual(await s.createLead(form), { success: true })
  const input = s.calls.find(call => call[0] === 'insert')[1]
  assert.equal(input.workspace_id, workspace)
  assert.equal(input.source_id, null)
  assert.deepEqual(Object.keys(input).sort(), ['first_name', 'last_name', 'phone', 'email', 'company_name', 'source_id', 'status', 'notes', 'workspace_id'].sort())
  assert.ok(!s.calls.some(call => call[0] === 'select'))
})

test('users without LEADS_MANAGE cannot create or edit before database access', async () => {
  for (const permissions of [[], ['LEADS_VIEW'], ['LEAD_SOURCES_VIEW']]) {
    const s = service(permissions)
    await assert.rejects(s.createLead(leadForm()), /NOT_FOUND/)
    await assert.rejects(s.updateLead(leadId, leadForm()), /NOT_FOUND/)
    await assert.rejects(s.getLeadForEdit(leadId), /NOT_FOUND/)
    assert.equal(s.calls.length, 0)
  }
})

test('authorized edit scopes preflight and update while preserving protected ownership and conversion fields', async () => {
  const s = service(['LEADS_VIEW', 'LEADS_MANAGE'], [
    { data: { id: leadId, status: 'NEW', source_id: sourceId }, error: null },
    { data: { id: leadId }, error: null },
  ])
  const form = leadForm('QUALIFIED')
  form.set('workspace_id', 'forged'); form.set('owner_user_id', 'forged'); form.set('converted_at', 'forged')
  assert.deepEqual(await s.updateLead(leadId, form), { id: leadId })
  const payload = s.calls.find(call => call[0] === 'update')[1]
  assert.equal(payload.status, 'QUALIFIED')
  assert.ok(!('source_id' in payload)); assert.ok(!('workspace_id' in payload)); assert.ok(!('owner_user_id' in payload)); assert.ok(!('converted_at' in payload))
  assert.equal(s.calls.filter(call => call[0] === 'eq' && call[1] === 'workspace_id' && call[2] === workspace).length, 2)
})

test('foreign and missing edit IDs share unavailable behavior and never update', async () => {
  for (const target of [leadId, '44444444-4444-4444-4444-444444444444', 'bad-id']) {
    const s = service(['LEADS_VIEW', 'LEADS_MANAGE'], [{ data: null, error: null }])
    assert.deepEqual(await s.updateLead(target, leadForm()), { error: 'Lead not found or unavailable.' })
    assert.ok(!s.calls.some(call => call[0] === 'update'))
  }
})

test('source assignment requires source view and a source in the active workspace', async () => {
  const form = leadForm(); form.set('source_id', sourceId)
  const crossWorkspace = service(['LEADS_VIEW', 'LEADS_MANAGE', 'LEAD_SOURCES_VIEW'], [{ data: null, error: null }])
  const result = await crossWorkspace.createLead(form)
  assert.equal(result.fields.source_id, 'Select an available lead source.')
  assert.ok(!crossWorkspace.calls.some(call => call[0] === 'insert'))
  assert.ok(crossWorkspace.calls.some(call => call[0] === 'eq' && call[1] === 'workspace_id' && call[2] === workspace))

  const allowed = service(['LEADS_VIEW', 'LEADS_MANAGE', 'LEAD_SOURCES_VIEW'], [{ data: { id: sourceId, is_active: true } }, { data: { id: leadId } }])
  assert.deepEqual(await allowed.createLead(form), { id: leadId })
  assert.equal(allowed.calls.find(call => call[0] === 'insert')[1].source_id, sourceId)
})

test('invalid and manually converted statuses cannot be persisted', async () => {
  for (const status of ['CONVERTED', 'INVALID', '']) {
    const s = service(['LEADS_MANAGE'])
    const result = await s.createLead(leadForm(status))
    assert.equal(result.fields.status, 'Select an available status.')
    assert.ok(!s.calls.some(call => call[0] === 'insert'))
  }
  const converted = service(['LEADS_VIEW', 'LEADS_MANAGE'], [{ data: { id: leadId, status: 'CONVERTED', source_id: null } }, { data: { id: leadId } }])
  assert.deepEqual(await converted.updateLead(leadId, leadForm('NEW')), { id: leadId })
  assert.equal(converted.calls.find(call => call[0] === 'update')[1].status, 'CONVERTED')
})

test('create/edit authentication redirects anonymous users before database access', async () => {
  const appContext = load('src/server/app-context.ts', {
    'server-only': {}, 'next/navigation': { redirect: path => { throw Error(`REDIRECT ${path}`) } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) }, from: () => { throw Error('Unexpected query') } }) },
  })
  const api = load('src/server/leads.ts', {
    'server-only': {}, 'next/navigation': { notFound: () => { throw Error('NOT_FOUND') } },
    '@/server/app-context': appContext, '@/features/leads/validation': validation,
  })
  await assert.rejects(api.createLead(leadForm()), /REDIRECT \/login/)
  await assert.rejects(api.updateLead(leadId, leadForm()), /REDIRECT \/login/)
})

test('lead form has pending UI and an immediate duplicate-submit guard', () => {
  const source = fs.readFileSync('src/components/leads/lead-form.tsx', 'utf8')
  assert.match(source, /useRef\(false\)/)
  assert.match(source, /submitting\.current \|\| pending/)
  assert.match(source, /disabled=\{pending\}/)
  assert.match(source, /Saving\.\.\./)
})
