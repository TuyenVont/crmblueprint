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

const companyValidation = load('src/features/companies/validation.ts')
const contactValidation = load('src/features/contacts/validation.ts')
const workspace = '11111111-1111-1111-1111-111111111111'
const companyId = '22222222-2222-2222-2222-222222222222'
const contactId = '33333333-3333-3333-3333-333333333333'
const linkId = '44444444-4444-4444-4444-444444444444'
const allPermissions = ['COMPANIES_VIEW', 'CONTACTS_VIEW', 'COMPANIES_MANAGE', 'CONTACTS_MANAGE']

function service(permissions = allPermissions, results = []) {
  const calls = []
  let index = 0
  const supabase = { from(table) {
    calls.push(['from', table])
    const result = results[index++] ?? { data: null, error: null }
    const chain = { then: resolve => Promise.resolve(result).then(resolve) }
    for (const method of ['select', 'eq', 'maybeSingle', 'insert', 'delete', 'or', 'order', 'range']) {
      chain[method] = (...args) => { calls.push([method, ...args]); return chain }
    }
    return chain
  } }
  const api = load('src/server/company-contacts.ts', {
    'server-only': {},
    '@/server/app-context': { getAppContext: async () => ({ workspaceId: workspace, permissions: new Set(permissions), supabase }) },
    '@/features/companies/validation': companyValidation,
    '@/features/contacts/validation': contactValidation,
  })
  return { ...api, calls }
}

test('relationship writes require view and manage permissions for both entity types before querying', async () => {
  for (const missing of allPermissions) {
    const permissions = allPermissions.filter(permission => permission !== missing)
    const s = service(permissions)
    assert.deepEqual(await s.linkCompanyContact(companyId, contactId), { error: 'You do not have permission to manage company contacts.' })
    assert.deepEqual(await s.unlinkCompanyContact(companyId, contactId), { error: 'You do not have permission to manage company contacts.' })
    assert.equal(s.calls.length, 0)
  }
})

test('signed-out relationship requests redirect before any database query', async () => {
  let queried = false
  const api = load('src/server/company-contacts.ts', {
    'server-only': {},
    '@/server/app-context': { getAppContext: async () => { throw new Error('REDIRECT /login') } },
    '@/features/companies/validation': companyValidation,
    '@/features/contacts/validation': contactValidation,
  })
  await assert.rejects(api.linkCompanyContact(companyId, contactId), /REDIRECT \/login/)
  await assert.rejects(api.unlinkCompanyContact(companyId, contactId), /REDIRECT \/login/)
  assert.equal(queried, false)
})

test('authorized link validates both records in the active workspace and inserts only derived workspace values', async () => {
  const s = service(undefined, [{ data: { id: companyId }, error: null }, { data: { id: contactId }, error: null }, { error: null }])
  assert.deepEqual(await s.linkCompanyContact(companyId, contactId), { success: true })
  assert.equal(s.calls.filter(call => call[0] === 'eq' && call[1] === 'workspace_id' && call[2] === workspace).length, 2)
  assert.deepEqual(s.calls.find(call => call[0] === 'insert')[1], { workspace_id: workspace, company_id: companyId, contact_id: contactId })
})

test('foreign and missing company or contact IDs have the same unavailable result and never insert', async () => {
  for (const results of [
    [{ data: null, error: null }],
    [{ data: { id: companyId }, error: null }, { data: null, error: null }],
    [{ data: null, error: { message: 'foreign secret' } }],
  ]) {
    const s = service(undefined, results)
    assert.deepEqual(await s.linkCompanyContact(companyId, contactId), { error: 'Company or contact not found or unavailable.' })
    assert.ok(!s.calls.some(call => call[0] === 'insert'))
  }
})

test('duplicate links are rejected with a friendly error', async () => {
  const s = service(undefined, [{ data: { id: companyId } }, { data: { id: contactId } }, { error: { code: '23505', message: 'raw duplicate detail' } }])
  assert.deepEqual(await s.linkCompanyContact(companyId, contactId), { error: 'This contact is already linked to the company.' })
})

test('authorized unlink scopes the relationship delete and does not delete either entity', async () => {
  const s = service(undefined, [{ data: { id: companyId } }, { data: { id: contactId } }, { data: { id: linkId } }, { error: null }])
  assert.deepEqual(await s.unlinkCompanyContact(companyId, contactId), { success: true })
  const fromCalls = s.calls.filter(call => call[0] === 'from').map(call => call[1])
  assert.deepEqual(fromCalls, ['companies', 'contacts', 'company_contacts', 'company_contacts'])
  assert.equal(s.calls.filter(call => call[0] === 'delete').length, 1)
  assert.ok(s.calls.some(call => call[0] === 'eq' && call[1] === 'id' && call[2] === linkId))
})

test('missing or cross-workspace relationships cannot be unlinked and do not disclose existence', async () => {
  const s = service(undefined, [{ data: { id: companyId } }, { data: { id: contactId } }, { data: null, error: null }])
  assert.deepEqual(await s.unlinkCompanyContact(companyId, contactId), { error: 'Company or contact not found or unavailable.' })
  assert.ok(!s.calls.some(call => call[0] === 'delete'))
})

test('contact picker is workspace scoped, searched server-side and limited to 20 rows', async () => {
  const contact = { id: contactId, first_name: 'Alice' }
  const s = service(undefined, [{ data: { id: companyId } }, { data: [contact], count: 21, error: null }])
  const result = await s.searchContactsForCompany(companyId, 2, ' Alice ')
  assert.deepEqual(result.contacts, [contact]); assert.equal(result.total, 21)
  assert.ok(s.calls.some(call => call[0] === 'eq' && call[1] === 'workspace_id' && call[2] === workspace))
  assert.ok(s.calls.some(call => call[0] === 'or' && call[1].includes('first_name.ilike')))
  assert.ok(s.calls.some(call => call[0] === 'range' && call[1] === 20 && call[2] === 39))
})
