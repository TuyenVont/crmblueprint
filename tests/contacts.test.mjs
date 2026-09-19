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
const validation = load('src/features/contacts/validation.ts')
const workspace = '11111111-1111-1111-1111-111111111111'
const id = '22222222-2222-2222-2222-222222222222'
function service(permissions = ['CONTACTS_VIEW', 'CONTACTS_MANAGE'], result = { data: { id }, error: null }) {
  const calls = []
  let index = 0
  const context = { workspaceId: workspace, permissions: new Set(permissions), supabase: { from: table => {
    calls.push(['from', table])
    const current = Array.isArray(result) ? result[index++] : result
    const chain = { then: resolve => Promise.resolve(current).then(resolve) }
    for (const method of ['select', 'eq', 'order', 'range', 'or', 'insert', 'update', 'maybeSingle', 'in']) chain[method] = (...args) => { calls.push([method, ...args]); return chain }
    return chain
  } } }
  return { calls, ...load('src/server/contacts.ts', { 'server-only': {}, 'next/navigation': { notFound: () => { throw Error('NOT_FOUND') } }, '@/server/app-context': { getAppContext: async () => context }, '@/features/contacts/validation': validation }) }
}
function form() { const f = new FormData(); f.set('first_name', ' Alice '); return f }
test('unauthorized and manage-only actors cannot read; read-only actors cannot mutate', async () => {
  for (const permissions of [[], ['CONTACTS_MANAGE']]) {
    const s = service(permissions)
    await assert.rejects(s.getContacts(1), /NOT_FOUND/)
    await assert.rejects(s.getContactById(id), /NOT_FOUND/)
    assert.equal(s.calls.length, 0)
  }
  const s = service(['CONTACTS_VIEW'])
  await assert.rejects(s.createContact(form()), /NOT_FOUND/)
  await assert.rejects(s.updateContact(id, form()), /NOT_FOUND/)
  assert.equal(s.calls.length, 0)
})
test('create derives workspace and ignores protected and relationship inputs', async () => {
  const s = service(); const f = form()
  for (const key of ['workspace_id', 'owner_user_id', 'source_id', 'company_id', 'id', 'created_at']) f.set(key, 'forged')
  assert.deepEqual(await s.createContact(f), { id })
  const input = s.calls.find(c => c[0] === 'insert')[1]
  assert.equal(input.workspace_id, workspace)
  assert.equal(input.first_name, 'Alice')
  for (const key of ['owner_user_id', 'source_id', 'company_id', 'id', 'created_at']) assert.ok(!(key in input))
})
test('update allowlist preserves protected fields and scopes contact ID to active workspace', async () => {
  const s = service(); const f = form(); f.set('workspace_id', 'forged'); f.set('owner_user_id', 'forged')
  assert.deepEqual(await s.updateContact(id, f), { id })
  const input = s.calls.find(c => c[0] === 'update')[1]
  assert.ok(!('workspace_id' in input)); assert.ok(!('owner_user_id' in input))
  assert.ok(s.calls.some(c => JSON.stringify(c) === JSON.stringify(['eq', 'workspace_id', workspace])))
  assert.ok(s.calls.some(c => JSON.stringify(c) === JSON.stringify(['eq', 'id', id])))
})
test('cross-workspace detail and update give no existence information', async () => {
  const s = service(undefined, { data: null, error: null })
  await assert.rejects(s.getContactById(id), /NOT_FOUND/)
  assert.match((await s.updateContact(id, form())).error, /not found or unavailable/)
  assert.ok(s.calls.filter(c => c[0] === 'eq' && c[1] === 'workspace_id').every(c => c[2] === workspace))
})
test('contact detail does not query or return company data without COMPANIES_VIEW', async () => {
  const s = service(['CONTACTS_VIEW'], { data: { id, first_name: 'Alice' }, error: null })
  const data = await s.getContactById(id)
  assert.equal(data.canViewCompanies, false)
  assert.deepEqual(data.contact.companies, [])
  assert.deepEqual(s.calls.filter(call => call[0] === 'from'), [['from', 'contacts']])
})
test('authorized contact detail reads linked companies from company_contacts', async () => {
  const companyId = '33333333-3333-3333-3333-333333333333'
  const link = { contact_id: id, job_title: null, is_primary: false, companies: { id: companyId, name: 'Acme' } }
  const s = service(['CONTACTS_VIEW', 'COMPANIES_VIEW'], [{ data: { id, first_name: 'Alice' }, error: null }, { data: [link], error: null }])
  const data = await s.getContactById(id)
  assert.deepEqual(data.contact.companies, [{ id: companyId, name: 'Acme', job_title: null, is_primary: false }])
  assert.ok(s.calls.some(call => call[0] === 'select' && call[1].includes('company_contacts_company_same_workspace_fk')))
  assert.ok(s.calls.some(call => call[0] === 'eq' && call[1] === 'workspace_id' && call[2] === workspace))
})
test('search and pagination keep workspace scope, stable ordering, bounded rows and total', async () => {
  const s = service(['CONTACTS_VIEW'], { data: [], error: null, count: 70 })
  const data = await s.getContacts(2, 'Alice')
  assert.equal(data.total, 70); assert.equal(data.canManage, false)
  for (const expected of [['eq', 'workspace_id', workspace], ['range', 50, 99], ['order', 'id'], ['order', 'created_at', { ascending: false }]]) assert.ok(s.calls.some(c => JSON.stringify(c) === JSON.stringify(expected)))
  assert.ok(s.calls.some(c => c[0] === 'or' && c[1].includes('email.ilike."%Alice%"')))
})
test('invalid input and raw database errors are contained', async () => {
  const s = service()
  const f = form(); f.set('first_name', ' '); f.set('birthday', '2026-02-30'); f.set('email', 'invalid')
  const result = await s.createContact(f)
  assert.ok(result.fields.first_name && result.fields.birthday && result.fields.email)
  assert.equal(s.calls.length, 0)
  await assert.rejects(s.getContacts(-1), /Invalid/)
  await assert.rejects(s.getContacts(1, 'x'.repeat(201)), /Invalid/)
  const failure = service(undefined, { data: null, error: { message: 'secret SQL details' } })
  assert.equal((await failure.createContact(form())).error, 'Unable to save contact. Please try again.')
})
test('literal search quotes filter syntax and escapes wildcard characters', () => {
  const filter = validation.contactSearchFilter('%,x"_')
  assert.ok(filter.includes('first_name.ilike."%'))
  assert.ok(filter.includes('\\\\%')); assert.ok(filter.includes('\\\\_')); assert.ok(filter.includes('\\"'))
})
test('App Shell contact navigation still requires actual view permission', () => {
  const { filterNavigation } = load('src/components/app-shell/navigation.ts')
  assert.ok(filterNavigation(new Set(['CONTACTS_VIEW'])).mainItems.some(i => i.href === '/app/contacts'))
  assert.ok(!filterNavigation(new Set(['CONTACTS_MANAGE'])).mainItems.some(i => i.href === '/app/contacts'))
})
