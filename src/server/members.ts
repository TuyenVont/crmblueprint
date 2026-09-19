import 'server-only'
import { getAppContext } from '@/server/app-context'
import type { MembersData, MembersReadResult, WorkspaceRole } from '@/features/members/types'

export async function membersContext() {
  const context = await getAppContext()
  if (!context.permissions.has('MEMBERS_VIEW')) {
    throw new Error('You do not have permission to view workspace members.')
  }
  return context
}

export async function getMembers(page: number, search = ''): Promise<MembersData> {
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 200) {
    throw new Error('Invalid member search or page.')
  }
  const { supabase, workspaceId, permissions } = await membersContext()
  const [membersResult, rolesResult, workspaceResult] = await Promise.all([
    supabase.rpc('list_workspace_members', {
      p_workspace_id: workspaceId, p_search: search.trim() || null,
      p_limit: 50, p_offset: (page - 1) * 50,
    }),
    permissions.has('MEMBERS_MANAGE') && permissions.has('ROLES_VIEW')
      ? supabase.from('roles').select('id, name, is_system').eq('workspace_id', workspaceId).order('name')
      : Promise.resolve({ data: [], error: null }),
    supabase.from('workspaces').select('name').eq('id', workspaceId).single(),
  ])
  if (membersResult.error || rolesResult.error || workspaceResult.error) {
    throw new Error('Unable to load workspace members. Please try again.')
  }
  const result = membersResult.data as MembersReadResult | null
  if (!result) throw new Error('Unable to load workspace members. Please try again.')
  return {
    workspaceId, workspaceName: workspaceResult.data.name, page,
    total: result.total, search, roles: rolesResult.data as WorkspaceRole[],
    canManage: permissions.has('MEMBERS_MANAGE'),
    members: result.members.map(row => ({
      id: row.workspace_member_id, user_id: row.user_id, name: row.display_name,
      email: row.email, role_id: row.role_id, role_name: row.role_name,
      role_is_system: row.role_is_system, status: row.status, created_at: row.joined_at,
    })),
  }
}
