import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface AppContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string; email?: string }
  workspaceId: string
  workspaceName: string
  userDisplayName: string
  userEmail: string
  permissions: Set<string>
}

export async function getAppContext(): Promise<AppContext> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch active workspace membership, preferring the most recently created/joined active workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role_id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (memberError) {
    throw memberError
  }

  if (!membership) {
    redirect('/onboarding/workspace')
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, slug')
    .eq('id', membership.workspace_id)
    .maybeSingle()

  if (workspaceError || !workspace) {
    throw workspaceError ?? new Error('Workspace not found')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  // Fetch effective workspace permissions via RPC
  const { data: mappings, error: permError } = await supabase.rpc(
    'get_my_workspace_permissions',
    {
      p_workspace_id: membership.workspace_id,
    }
  )

  const permissions = new Set<string>(
    permError || !mappings
      ? []
      : (mappings as { permission_code: string }[]).map(r => r.permission_code)
  )

  const workspaceName = workspace?.name || 'Workspace'
  const userDisplayName = profile?.full_name || user.email || 'Người dùng'
  const userEmail = user.email || ''

  return {
    supabase,
    user,
    workspaceId: membership.workspace_id as string,
    workspaceName,
    userDisplayName,
    userEmail,
    permissions,
  }
}
