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
const validation = load('src/features/companies/validation.ts')
const workspace = '11111111-1111-1111-1111-111111111111'
const id = '22222222-2222-2222-2222-222222222222'
function service(permissions = ['COMPANIES_VIEW'], results = [{ data: { id }, error: null }]) {
  const calls = []
  let index = 0
  const context = { workspaceId: workspace, permissions: new Set(permissions), supabase: { from: table => {
    calls.push(['from', table])
    const result = results[index++]
    const chain = { then: resolve => Promise.resolve(result).then(resolve) }
    for (const method of ['select', 'eq', 'order', 'range', 'or', 'maybeSingle', 'insert', 'update']) chain[method] = (...args) => { calls.push([method, ...args]); return chain }
    return chain
  } } }
  return { calls, ...load('src/server/companies.ts', { 'server-only': {}, 'next/navigation': { notFound: () => { throw Error('NOT_FOUND') } }, '@/server/app-context': { getAppContext: async () => context }, '@/features/companies/validation': validation }) }
}
test('view permission required before all queries, regardless of manage permission', async () => {
  for (const permissions of [[], ['COMPANIES_MANAGE'], ['CONTACTS_VIEW']]) {
    const s = service(permissions)
    await assert.rejects(s.getCompanies(1), /NOT_FOUND/)
    await assert.rejects(s.getCompanyById(id), /NOT_FOUND/)
    assert.equal(s.calls.length, 0)
  }
})
test('company-only reader never queries relationships or contacts', async () => {
  const s = service(['COMPANIES_VIEW', 'CONTACTS_MANAGE'])
  const data = await s.getCompanyById(id)
  assert.equal(data.canViewContacts, false)
  assert.deepEqual(data.contacts, [])
  assert.deepEqual(s.calls.filter(c => c[0] === 'from'), [['from', 'companies']])
})
test('linked contacts use composite relationship, scoped company/workspace and bounded stable pagination', async () => {
  const link = { job_title: 'Director', is_primary: true, contacts: { id, first_name: 'Alice' } }
  const s = service(['COMPANIES_VIEW', 'CONTACTS_VIEW'], [{ data: { id }, error: null }, { data: [link], count: 51, error: null }])
  const data = await s.getCompanyById(id, 2)
  assert.deepEqual(data.contacts, [link]); assert.equal(data.contactsTotal, 51)
  assert.equal(s.calls.filter(c => c[0] === 'eq' && c[1] === 'workspace_id' && c[2] === workspace).length, 2)
  assert.ok(s.calls.some(c => c[0] === 'eq' && c[1] === 'company_id' && c[2] === id))
  assert.ok(s.calls.some(c => c[0] === 'select' && c[1].includes('company_contacts_contact_same_workspace_fk!inner')))
  assert.ok(s.calls.some(c => c[0] === 'range' && c[1] === 50 && c[2] === 99))
})
test('list search scopes workspace, uses exact count and stable 50-row pagination', async () => {
  const s = service(undefined, [{ data: [], error: null, count: 70 }])
  assert.equal((await s.getCompanies(2, ' Alice ')).total, 70)
  for (const expected of [['eq', 'workspace_id', workspace], ['range', 50, 99], ['order', 'id'], ['order', 'created_at', { ascending: false }]]) assert.ok(s.calls.some(c => JSON.stringify(c) === JSON.stringify(expected)))
  assert.ok(s.calls.some(c => c[0] === 'or' && c[1].includes('name.ilike."%Alice%"')))
  assert.ok(s.calls.some(c => c[0] === 'select' && c[2]?.count === 'exact'))
})
test('missing, foreign and malformed IDs reveal no existence information', async () => {
  const s = service(undefined, [{ data: null, error: null }])
  await assert.rejects(s.getCompanyById(id), /NOT_FOUND/)
  assert.ok(s.calls.some(c => c[0] === 'eq' && c[1] === 'workspace_id' && c[2] === workspace))
  const invalid = service()
  await assert.rejects(invalid.getCompanyById('bad'), /NOT_FOUND/)
  assert.equal(invalid.calls.length, 0)
})
test('invalid pagination and long searches fail before business queries', async () => {
  const s = service()
  for (const page of [0, -1, 1.5, NaN, Infinity, 100001]) await assert.rejects(s.getCompanies(page), /Invalid/)
  await assert.rejects(s.getCompanies(1, 'x'.repeat(201)), /Invalid/)
  await assert.rejects(s.getCompanyById(id, 0), /Invalid/)
  assert.equal(s.calls.length, 0)
})
test('database errors never expose raw details from either company or relationship queries', async () => {
  const error = { message: 'foreign secret ID and SQL' }
  await assert.rejects(service(undefined, [{ error }]).getCompanies(1), { message: 'Unable to load companies. Please try again.' })
  await assert.rejects(service(undefined, [{ error }]).getCompanyById(id), { message: 'Unable to load company. Please try again.' })
  await assert.rejects(service(['COMPANIES_VIEW', 'CONTACTS_VIEW'], [{ data: { id } }, { error }]).getCompanyById(id), { message: 'Unable to load linked contacts. Please try again.' })
})
test('company search retains Contacts literal filter escaping', () => {
  const contacts = load('src/features/contacts/validation.ts')
  for (const input of ['%,x"_', 'a\\b', 'hello),name.eq.secret', 'Tiếng Việt']) {
    assert.equal(validation.companySearchFilter(input), contacts.contactSearchFilter(input).replace('first_name.ilike', 'name.ilike').replace(/,last_name\.ilike\.("(?:\\.|[^"\\])*")/, ''))
  }
})
test('company navigation uses view permission', () => {
  const { filterNavigation } = load('src/components/app-shell/navigation.ts')
  assert.ok(filterNavigation(new Set(['COMPANIES_VIEW'])).mainItems.some(i => i.href === '/app/companies'))
  assert.ok(!filterNavigation(new Set(['COMPANIES_MANAGE'])).mainItems.some(i => i.href === '/app/companies'))
})

function companyForm() { const form = new FormData(); form.set('name', ' Acme '); return form }
const manager = ['COMPANIES_VIEW', 'COMPANIES_MANAGE']

test('manage-only can create without requesting a forbidden read; view/manage creation returns ID', async () => {
  const s = service(['COMPANIES_MANAGE'], [{ error: null }])
  assert.deepEqual(await s.createCompany(companyForm()), { success: true })
  assert.ok(!s.calls.some(call => call[0] === 'select'))
  assert.deepEqual(s.calls.find(call => call[0] === 'insert')[1], { name: 'Acme', tax_id: null, email: null, phone: null, website: null, address: null, industry: null, size: null, workspace_id: workspace })
  assert.deepEqual(await service(manager).createCompany(companyForm()), { id })
})

test('missing manage permission denies create, edit rendering and mutation before queries', async () => {
  for (const permissions of [[], ['COMPANIES_VIEW']]) {
    const s = service(permissions)
    await assert.rejects(s.createCompany(companyForm()), /NOT_FOUND/)
    await assert.rejects(s.getCompanyForEdit(id), /NOT_FOUND/)
    await assert.rejects(s.updateCompany(id, companyForm()), /NOT_FOUND/)
    assert.deepEqual(s.calls, [])
  }
  const s = service(['COMPANIES_MANAGE'])
  await assert.rejects(s.getCompanyForEdit(id), /NOT_FOUND/)
  await assert.rejects(s.updateCompany(id, companyForm()), /NOT_FOUND/)
  assert.deepEqual(s.calls, [])
})

test('real app-context authentication redirects anonymous create and edit before database access', async () => {
  const appContext = load('src/server/app-context.ts', {
    'server-only': {}, 'next/navigation': { redirect: path => { throw Error(`REDIRECT ${path}`) } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) }, from: () => { throw Error('Unexpected query') } }) },
  })
  const s = load('src/server/companies.ts', { 'server-only': {}, 'next/navigation': { notFound: () => { throw Error('NOT_FOUND') } }, '@/server/app-context': appContext, '@/features/companies/validation': validation })
  await assert.rejects(s.createCompany(companyForm()), /REDIRECT \/login/)
  await assert.rejects(s.updateCompany(id, companyForm()), /REDIRECT \/login/)
  await assert.rejects(s.getCompanyForEdit(id), /REDIRECT \/login/)
})

test('create ignores client workspace, protected fields and relationship injection', async () => {
  const form = companyForm()
  for (const key of ['id', 'workspace_id', 'owner_user_id', 'created_at', 'updated_at', 'created_by', 'company_contacts', 'contact_id']) form.set(key, 'forged')
  const s = service(manager)
  await s.createCompany(form)
  const input = s.calls.find(call => call[0] === 'insert')[1]
  assert.equal(input.workspace_id, workspace)
  assert.deepEqual(Object.keys(input).sort(), ['name', 'tax_id', 'phone', 'email', 'website', 'address', 'industry', 'size', 'workspace_id'].sort())
  assert.deepEqual(s.calls.filter(call => call[0] === 'from'), [['from', 'companies']])
})

test('edit scopes both preflight and update to active workspace and preserves protected fields', async () => {
  const form = companyForm(); form.set('workspace_id', 'forged'); form.set('owner_user_id', 'forged'); form.set('created_at', 'forged')
  const s = service(manager, [{ data: { id } }, { data: { id } }])
  assert.deepEqual(await s.updateCompany(id, form), { id })
  assert.equal(s.calls.filter(call => call[0] === 'eq' && call[1] === 'workspace_id' && call[2] === workspace).length, 2)
  assert.equal(s.calls.filter(call => call[0] === 'eq' && call[1] === 'id' && call[2] === id).length, 2)
  assert.deepEqual(Object.keys(s.calls.find(call => call[0] === 'update')[1]).sort(), ['name', 'tax_id', 'phone', 'email', 'website', 'address', 'industry', 'size'].sort())
  assert.ok(s.calls.filter(call => call[0] === 'from').every(call => call[1] === 'companies'))
  const loader = service(manager)
  assert.deepEqual(await loader.getCompanyForEdit(id), { id })
  assert.ok(loader.calls.some(call => call[0] === 'eq' && call[1] === 'workspace_id' && call[2] === workspace))
})

test('foreign, missing and malformed edits have identical unavailable outcomes and never update', async () => {
  for (const target of [id, '33333333-3333-3333-3333-333333333333', 'malformed']) {
    const s = service(manager, [{ data: null }])
    assert.deepEqual(await s.updateCompany(target, companyForm()), { error: 'Company not found or unavailable.' })
    assert.ok(!s.calls.some(call => call[0] === 'update'))
    await assert.rejects(service(manager, [{ data: null }]).getCompanyForEdit(target), /NOT_FOUND/)
  }
})

test('validation normalizes optional blanks and rejects bad fields without mutation', async () => {
  const form = companyForm(); form.set('email', ' hello@example.com '); form.set('size', ' ')
  const normalized = validation.validateCompany(form)
  assert.equal(normalized.input.name, 'Acme'); assert.equal(normalized.input.email, 'hello@example.com'); assert.equal(normalized.input.size, null)
  form.set('name', ' '); form.set('email', 'invalid'); form.set('website', 'javascript:alert(1)'); form.set('phone', 'x'.repeat(81))
  const s = service(manager)
  const result = await s.createCompany(form)
  for (const key of ['name', 'email', 'website', 'phone']) assert.ok(result.fields[key])
  assert.equal(result.values.email, 'invalid'); assert.deepEqual(s.calls, [])
  for (const [key, max] of Object.entries({ name: 200, tax_id: 200, email: 320, phone: 80, website: 2000, address: 2000, industry: 200, size: 200 })) {
    const f = companyForm(); f.set(key, 'x'.repeat(max + 1)); assert.ok(validation.validateCompany(f).fields[key])
  }
  for (const url of ['https://example.com/path', 'http://example.com']) {
    const f = companyForm(); f.set('website', url); assert.ok(!validation.validateCompany(f).fields.website)
  }
  const f = companyForm(); f.set('website', 'https://user:pass@example.com'); f.set('tax_id', new Blob(['file']))
  assert.ok(validation.validateCompany(f).fields.website); assert.ok(validation.validateCompany(f).fields.tax_id)
})

test('mutation errors hide database details and preserve input; concurrent removal is unavailable', async () => {
  const error = { message: 'secret SQL and foreign workspace ID' }
  for (const permissions of [manager, ['COMPANIES_MANAGE']]) {
    const result = await service(permissions, [{ error }]).createCompany(companyForm())
    assert.equal(result.error, 'Unable to save company. Please try again.'); assert.equal(result.values.name, 'Acme')
  }
  assert.equal((await service(manager, [{ error }]).updateCompany(id, companyForm())).error, 'Unable to save company. Please try again.')
  assert.equal((await service(manager, [{ data: { id } }, { error }]).updateCompany(id, companyForm())).error, 'Unable to save company. Please try again.')
  assert.equal((await service(manager, [{ data: { id } }, { data: null }]).updateCompany(id, companyForm())).error, 'Company not found or unavailable.')
})

test('actions redirect only after success, invalidate dependent views and never trust previous state', async () => {
  function action(result) {
    const calls = []
    const mutation = async (...args) => { calls.push(['mutation', ...args]); return result }
    return { calls, ...load('src/app/app/companies/actions.ts', {
      'next/navigation': { redirect: path => { throw Error(`REDIRECT ${path}`) } },
      'next/cache': { revalidatePath: (...args) => calls.push(['revalidate', ...args]) },
      '@/server/companies': { createCompany: mutation, updateCompany: mutation },
    }) }
  }
  const s = action({ id })
  await assert.rejects(s.saveCompanyAction(id, { success: true }, companyForm()), new RegExp(`REDIRECT /app/companies/${id}`))
  assert.ok(s.calls.some(call => call[0] === 'revalidate' && call[1] === '/app/contacts'))
  const noView = action({ success: true })
  assert.deepEqual(await noView.saveCompanyAction(null, {}, companyForm()), { success: true })
  const failure = action({ error: 'Unable to save company. Please try again.' })
  assert.ok((await failure.saveCompanyAction(null, { success: true }, companyForm())).error)
  assert.ok(!failure.calls.some(call => call[0] === 'revalidate'))
})
