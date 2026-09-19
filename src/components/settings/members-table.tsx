'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import type { Member, MemberAction, MembersData } from '@/features/members/types'
import { mutateMember } from '@/app/app/settings/members/actions'

const button = 'rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'

export function MembersTable({ data }: { data: MembersData }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({})
  const [selection, setSelection] = useState<{ member: Member; action: MemberAction } | null>(null)
  const [roleId, setRoleId] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const pageHref = (page: number) => `?${new URLSearchParams({ page: String(page), search: data.search })}`

  function open(member: Member, action: MemberAction) {
    setSelection({ member, action })
    setRoleId(member.role_id)
    setFeedback({})
    dialog.current?.showModal()
  }

  function submit() {
    if (!selection || busy) return
    startTransition(async () => {
      try {
        const result = await mutateMember(data.workspaceId, selection.member.id, selection.action, roleId)
        if (result.error) { setFeedback({ error: result.error }); return }
        dialog.current?.close()
        setSelection(null)
        setFeedback({ success: 'Member updated successfully.' })
        router.refresh()
      } catch {
        setFeedback({ error: 'Connection interrupted. Refresh to check the result before trying again.' })
      }
    })
  }

  return <section className="rounded-xl border border-gray-200 bg-white shadow-sm" aria-label="Members">
    <div className="border-b border-gray-200 p-4 text-sm text-gray-600">{data.total} members</div>
    {feedback.success && <p role="status" className="m-4 rounded-lg bg-green-50 p-3 text-green-800">{feedback.success}</p>}
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600"><tr>{['Name', 'Email', 'Role', 'Status', 'Joined date', ...(data.canManage ? ['Actions'] : [])].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">{data.members.map(member => {
          // Conservative presentation only: hide actions for every system Owner.
          // This is the documented protected identity, not a permission check.
          const protectedOwner = member.role_is_system && member.role_name === 'Owner'
          return <tr key={member.id}>
            <td className="px-4 py-4 font-medium">{member.name}</td>
            <td className="px-4 py-4 text-gray-600">{member.email || 'No email'}</td>
            <td className="px-4 py-4">{member.role_name}</td>
            <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs ${member.status === 'ACTIVE' ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{member.status}</span></td>
            <td className="whitespace-nowrap px-4 py-4">{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(member.created_at))}</td>
            {data.canManage && <td className="px-4 py-4">{protectedOwner ? <span className="text-xs text-gray-500">Protected Owner</span> : <div className="flex flex-wrap gap-2">
              {data.roles.length > 0 && <button className={button} disabled={busy} onClick={() => open(member, 'role')}>Change role</button>}
              {member.status !== 'INVITED' && <button className={button} disabled={busy} onClick={() => open(member, member.status === 'ACTIVE' ? 'disable' : 'enable')}>{member.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button>}
              <button className={`${button} text-red-700`} disabled={busy} onClick={() => open(member, 'remove')}>Remove</button>
            </div>}</td>}
          </tr>
        })}</tbody>
      </table>
      {data.members.length === 0 && <p className="p-10 text-center text-gray-500">No members on this page.</p>}
    </div>
    <footer className="flex items-center justify-between border-t border-gray-200 p-4 text-sm">
      <span>Page {data.page} of {Math.max(1, Math.ceil(data.total / 50))}</span>
      <div className="flex gap-4">{data.page > 1 && <Link className="text-indigo-700 underline" href={pageHref(data.page - 1)}>Previous</Link>}{data.page * 50 < data.total && <Link className="text-indigo-700 underline" href={pageHref(data.page + 1)}>Next</Link>}</div>
    </footer>
    <dialog ref={dialog} aria-labelledby="member-dialog-title" onCancel={event => { if (busy) event.preventDefault() }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-6 shadow-xl backdrop:bg-black/40">
      <form onSubmit={event => { event.preventDefault(); submit() }}>
        <h2 id="member-dialog-title" className="text-lg font-semibold">{selection?.action === 'role' ? 'Change role' : selection?.action === 'remove' ? 'Remove member?' : selection?.action === 'disable' ? 'Disable member?' : 'Enable member?'}</h2>
        <p className="my-4 text-sm text-gray-600">{selection?.member.name}{selection?.action === 'remove' ? ' will lose access to this workspace. This cannot be undone here.' : selection?.action === 'disable' ? ' will lose workspace access until enabled again.' : ''}</p>
        {selection?.action === 'role' && <label className="block text-sm">Role<select className="mt-2 w-full rounded-lg border border-gray-300 p-2" value={roleId} disabled={busy} onChange={event => setRoleId(event.target.value)}>{data.roles.filter(role => !(role.is_system && role.name === 'Owner')).map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>}
        {feedback.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{feedback.error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" autoFocus className={button} disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit" disabled={busy || (selection?.action === 'role' && roleId === selection.member.role_id)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Saving…' : 'Confirm'}</button>
        </div>
      </form>
    </dialog>
  </section>
}
