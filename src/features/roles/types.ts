export type Role = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  is_system: boolean
  created_at: string
  updated_at: string
}

export type Permission = {
  id: string
  code: string
  description: string
}

export type RolePermissionMapping = {
  role_id: string
  permission_id: string
}

export type PermissionGroup = {
  domain: string
  permissions: {
    code: string
    description: string
    isAssigned: boolean
  }[]
}

export type RolesData = {
  workspaceId: string
  workspaceName: string
  roles: (Role & { permissionCount: number })[]
  permissionsByRole: Record<string, Set<string>>
  allPermissions: Permission[]
}
