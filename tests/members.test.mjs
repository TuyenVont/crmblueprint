import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

// Exercise the real server modules with an authenticated-client double.
// These checks do not substitute for hosted RLS or browser verification.
function load(file, imports) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)(name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  }, exports)
  return exports
}

const workspaceId = '11111111-1111-1111-1111-111111111111'
const memberId = '22222222-2222-2222-2222-222222222222'
const roleId = '33333333-3333-3333-3333-333333333333'
function actions({ permission = true, rpcError = null } = {}) {
  const calls = []
  const actionModule = load('src/app/app/settings/members/actions.ts', {
    'next/cache': { revalidatePath: path => calls.push(['revalidate', path]) },
    '@/server/members': { membersContext: async () => ({
      workspaceId, permissions: new Set(permission ? ['MEMBERS_MANAGE'] : []),
      supabase: { rpc: async (...args) => { calls.push(args); return { error: rpcError } } },
    }) },
  })
  return { ...actionModule, calls }
}

test('all mutations use only their designated RPC with server-resolved workspace and member row ID', async () => {
  for (const [action, rpc] of Object.entries({ role: 'change_member_role', disable: 'disable_workspace_member', enable: 'enable_workspace_member', remove: 'remove_workspace_member' })) {
    const { mutateMember, calls } = actions()
    assert.deepEqual(await mutateMember(workspaceId, memberId, action, roleId), { success: true })
    assert.deepEqual(calls[0], [rpc, { p_workspace_id: workspaceId, p_member_id: memberId, ...(action === 'role' ? { p_role_id: roleId } : {}) }])
    assert.deepEqual(calls[1], ['revalidate', '/app/settings/members'])
  }
})

test('invalid input, missing permission and workspace mismatch never invoke RPC', async () => {
  for (const [allowed, workspace, member, action] of [
    [false, workspaceId, memberId, 'disable'], [true, roleId, memberId, 'remove'],
    [true, workspaceId, 'invalid', 'enable'], [true, workspaceId, memberId, 'toString'],
  ]) {
    const { mutateMember, calls } = actions({ permission: allowed })
    assert.ok((await mutateMember(workspace, member, action)).error)
    assert.equal(calls.length, 0)
  }
})

test('backend security, CRM references and concurrency errors produce friendly feedback', async () => {
  for (const [rpcError, expected] of [
    [{ message: 'FORBIDDEN' }, /no longer have permission/],
    [{ message: 'LAST_ACTIVE_OWNER' }, /at least one active Owner/],
    [{ message: 'OWNER_PROTECTED' }, /protected/],
    [{ message: 'ROLE_EXCEEDS_ACTOR_PERMISSIONS' }, /beyond/],
    [{ message: 'MEMBER_REFERENCED_USE_DISABLE' }, /Disable them instead/],
    [{ message: 'internal foreign key details', code: '23503' }, /Disable them instead/],
    [{ message: 'serialization', code: '40001' }, /same time/],
    [{ message: 'secret SQL details' }, /could not be completed/],
  ]) {
    const { mutateMember, calls } = actions({ rpcError })
    assert.match((await mutateMember(workspaceId, memberId, 'remove')).error, expected)
    assert.equal(calls.length, 1)
  }
})

test('MEMBERS_VIEW alone reads other member email and role through RPC, preserving search and pagination', async () => {
  const calls = []
  const fixtures = {
    workspace_members: [{ data: { workspace_id: workspaceId, role_id: roleId } }],
    profiles: [{ data: { full_name: 'Reader' } }],
    workspaces: [{ data: { name: 'Test workspace' } }],
  }
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'user', email: 'reader@example.test' } } }) },
    rpc: async (name, args) => {
      calls.push([name, args])
      if (name === 'get_my_workspace_permissions') return { data: [{ permission_code: 'MEMBERS_VIEW' }] }
      assert.equal(name, 'list_workspace_members')
      return { data: { members: [{ workspace_member_id: memberId, user_id: 'other-user',
        display_name: 'Other member', email: 'other@example.test', role_id: roleId,
        role_name: 'Reader', role_is_system: false, status: 'ACTIVE', joined_at: '2026-09-15' }], total: 51 } }
    },
    from(table) {
      const result = fixtures[table].shift()
      const chain = { then: resolve => Promise.resolve(result).then(resolve) }
      for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle', 'range', 'single', 'in']) {
        chain[method] = (...args) => { calls.push([table, method, ...args]); return chain }
      }
      return chain
    },
  }
  const contextModule = load('src/server/app-context.ts', {
    'next/navigation': { redirect: () => { throw new Error('redirect') } },
    'server-only': {}, '@/lib/supabase/server': { createClient: async () => supabase },
  })
  const { getMembers } = load('src/server/members.ts', {
    'server-only': {}, '@/server/app-context': contextModule,
  })
  const data = await getMembers(2, 'other')
  assert.equal(data.canManage, false)
  assert.equal(data.members[0].name, 'Other member')
  assert.equal(data.members[0].email, 'other@example.test')
  assert.equal(data.members[0].role_name, 'Reader')
  assert.equal(data.total, 51)
  assert.deepEqual(data.roles, [])
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['workspace_members', 'eq', 'status', 'ACTIVE'])))
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['get_my_workspace_permissions', { p_workspace_id: workspaceId }])))
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['list_workspace_members', {
    p_workspace_id: workspaceId, p_search: 'other', p_limit: 50, p_offset: 50,
  }])))
})

test('permission read failure and missing MEMBERS_VIEW stop member fetching', async () => {
  for (const result of [{ data: [], error: null }, { data: null, error: { message: 'FORBIDDEN' } }]) {
    const { getMembers } = load('src/server/members.ts', {
      'server-only': {}, '@/server/app-context': { getAppContext: async () => ({
        workspaceId, permissions: new Set((result.data || []).map(r => r.permission_code)),
        supabase: { from: () => { throw new Error('Unexpected read') } },
      }) },
    })
    await assert.rejects(getMembers(1), /permission/i)
  }
})
