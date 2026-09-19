'use client'
import { useActionState, useEffect, useRef, type FormEvent } from 'react'
import { linkContactAction, unlinkContactAction } from '@/app/app/companies/relationship-actions'
import type { RelationshipActionState } from '@/server/company-contacts'

function useSubmitGuard(pending: boolean, state: RelationshipActionState) {
  const submitting = useRef(false)
  useEffect(() => { if (!pending) submitting.current = false }, [pending, state])
  return (event: FormEvent<HTMLFormElement>) => {
    if (submitting.current || pending) event.preventDefault()
    else submitting.current = true
  }
}

export function LinkContactButton({ companyId, contactId }: { companyId: string; contactId: string }) {
  const [state, action, pending] = useActionState(linkContactAction.bind(null, companyId), {})
  const guardSubmit = useSubmitGuard(pending, state)
  return <form action={action} aria-busy={pending} onSubmit={guardSubmit} className="flex flex-col items-end gap-1">
    <input type="hidden" name="contact_id" value={contactId} />
    <button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">{pending ? 'Adding...' : 'Add'}</button>
    {state.error && <p role="alert" className="max-w-64 text-right text-xs text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-xs text-green-700">Contact added.</p>}
  </form>
}

export function UnlinkContactButton({ companyId, contactId }: { companyId: string; contactId: string }) {
  const [state, action, pending] = useActionState(unlinkContactAction.bind(null, companyId), {})
  const guardSubmit = useSubmitGuard(pending, state)
  return <form action={action} aria-busy={pending} onSubmit={guardSubmit} className="flex flex-col items-end gap-1">
    <input type="hidden" name="contact_id" value={contactId} />
    <button disabled={pending} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50">{pending ? 'Removing...' : 'Unlink'}</button>
    {state.error && <p role="alert" className="max-w-64 text-right text-xs text-red-700">{state.error}</p>}
  </form>
}
