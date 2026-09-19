import 'server-only'
import { getAppContext } from '@/server/app-context'
import type { Permission, Role, RolesData } from '@/features/roles/types'

export async function rolesContext() {
  const context = await getAppContext()
  if (!context.permissions.has('ROLES_VIEW')) {
    throw new Error('FORBIDDEN')
  }
  return context
}

export async function getRolesData(): Promise<RolesData> {
  const { supabase, workspaceId } = await rolesContext()

  const [rolesResult, permissionsResult, workspaceResult] = await Promise.all([
    supabase
      .from('roles')
      .select('id, workspace_id, name, description, is_system, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('is_system', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('permissions')
      .select('id, code, description')
      .order('code', { ascending: true }),
    supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single(),
  ])

  if (rolesResult.error || permissionsResult.error || workspaceResult.error) {
    throw new Error('Unable to load roles and permissions. Please try again.')
  }

  const roles = (rolesResult.data ?? []) as Role[]
  const allPermissions = (permissionsResult.data ?? []) as Permission[]
  const roleIds = roles.map(r => r.id)

  let rolePermissionsData: { role_id: string; permission_id: string }[] = []
  if (roleIds.length > 0) {
    const { data: rpData, error: rpError } = await supabase
      .from('role_permissions')
      .select('role_id, permission_id')
      .in('role_id', roleIds)

    if (rpError) {
      throw new Error('Unable to load role permission mappings. Please try again.')
    }
    rolePermissionsData = rpData ?? []
  }

  // Create permission lookup by ID
  const permCodeById = new Map<string, string>()
  for (const p of allPermissions) {
    permCodeById.set(p.id, p.code)
  }

  // Map role_id to set of permission codes
  const permissionsByRole: Record<string, Set<string>> = {}
  for (const r of roles) {
    permissionsByRole[r.id] = new Set<string>()
  }

  for (const mapping of rolePermissionsData) {
    const code = permCodeById.get(mapping.permission_id)
    if (code && permissionsByRole[mapping.role_id]) {
      permissionsByRole[mapping.role_id].add(code)
    }
  }

  const rolesWithCount = roles.map(r => ({
    ...r,
    permissionCount: permissionsByRole[r.id]?.size ?? 0,
  }))

  return {
    workspaceId,
    workspaceName: workspaceResult.data.name,
    roles: rolesWithCount,
    permissionsByRole,
    allPermissions,
  }
}
