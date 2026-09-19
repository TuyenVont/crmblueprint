export type WorkspaceRole = { id: string; name: string; is_system: boolean }
export type Member = {
  id: string
  user_id: string
  role_id: string
  role_name: string
  role_is_system: boolean
  status: string
  created_at: string
  name: string
  email: string | null
}
export type MemberAction = 'role' | 'disable' | 'enable' | 'remove'
export type MembersData = {
  workspaceId: string
  workspaceName: string
  members: Member[]
  roles: WorkspaceRole[]
  canManage: boolean
  page: number
  total: number
  search: string
}

export type MembersReadResult = {
  members: {
    workspace_member_id: string
    user_id: string
    display_name: string
    email: string | null
    role_id: string
    role_name: string
    role_is_system: boolean
    status: string
    joined_at: string
  }[]
  total: number
}
