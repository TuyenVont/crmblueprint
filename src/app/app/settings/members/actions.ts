'use server'

import { revalidatePath } from 'next/cache'
import { membersContext } from '@/server/members'
import type { MemberAction } from '@/features/members/types'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const rpcNames = {
  role: 'change_member_role', disable: 'disable_workspace_member',
  enable: 'enable_workspace_member', remove: 'remove_workspace_member',
} as const

function rpcMessage(error: { message: string; code?: string }) {
  if (error.message.includes('MEMBER_REFERENCED_USE_DISABLE') || error.code === '23503')
    return 'This member is linked to CRM records. Disable them instead to preserve the history.'
  if (error.message.includes('LAST_ACTIVE_OWNER')) return 'The workspace must retain at least one active Owner.'
  if (error.message.includes('OWNER_PROTECTED')) return 'This Owner member is protected. Your access does not allow this change.'
  if (error.message.includes('ROLE_EXCEEDS_ACTOR_PERMISSIONS')) return 'This role has permissions beyond those you can manage.'
  if (error.message.includes('FORBIDDEN') || error.code === '42501') return 'You no longer have permission to make this change. Refresh the page.'
  if (error.message.includes('AUTH_REQUIRED')) return 'Please sign in again.'
  if (error.message.includes('NOT_FOUND')) return 'The member or role is no longer available. Refresh the page.'
  if (error.message.includes('INVALID_MEMBER_STATUS')) return 'This action is unavailable for the current member status.'
  if (error.code === '40001' || error.code === '40P01') return 'Another change happened at the same time. Please try again.'
  return 'The change could not be completed. Refresh the page and try again.'
}

export async function mutateMember(workspaceId: string, memberId: string, action: MemberAction, roleId?: string) {
  if (!uuid.test(workspaceId) || !uuid.test(memberId) || !Object.hasOwn(rpcNames, action) ||
    (action === 'role' && (!roleId || !uuid.test(roleId)))) return { error: 'Invalid member action.' }
  try {
    const context = await membersContext()
    if (context.workspaceId !== workspaceId) return { error: 'The active workspace has changed. Refresh the page.' }
    if (!context.permissions.has('MEMBERS_MANAGE')) return { error: 'You do not have permission to manage members.' }
    const { error } = await context.supabase.rpc(rpcNames[action], {
      p_workspace_id: context.workspaceId, p_member_id: memberId,
      ...(action === 'role' ? { p_role_id: roleId } : {}),
    })
    if (error) return { error: rpcMessage(error) }
    revalidatePath('/app/settings/members')
    return { success: true }
  } catch {
    return { error: 'Unable to verify access or complete the request. Refresh the page and try again.' }
  }
}
