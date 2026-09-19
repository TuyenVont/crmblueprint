'use client'
import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'
import { saveLeadAction } from '@/app/app/leads/actions'
import { editableLeadStatuses } from '@/features/leads/validation'
import type { LeadFormLead, LeadInput, LeadSourceOption } from '@/features/leads/types'

const fields: { key: keyof Pick<LeadInput, 'first_name' | 'last_name' | 'email' | 'phone' | 'company_name'>; label: string; type?: string; max: number }[] = [
  { key: 'first_name', label: 'First name', max: 200 },
  { key: 'last_name', label: 'Last name', max: 200 },
  { key: 'email', label: 'Email', type: 'email', max: 320 },
  { key: 'phone', label: 'Phone', type: 'tel', max: 80 },
  { key: 'company_name', label: 'Company name', max: 200 },
]

export function LeadForm({ lead, sources, canViewSources, canViewLeads = true }: { lead?: LeadFormLead; sources: LeadSourceOption[]; canViewSources: boolean; canViewLeads?: boolean }) {
  const [state, action, pending] = useActionState(saveLeadAction.bind(null, lead?.id || null), {})
  const submitting = useRef(false)
  useEffect(() => { if (!pending) submitting.current = false }, [pending, state])
  const values = state.values || lead
  const converted = lead?.status === 'CONVERTED'
  return <form action={action} aria-busy={pending} onSubmit={event => {
    if (submitting.current || pending) event.preventDefault()
    else submitting.current = true
  }} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-700">Lead created successfully.</p>}
    <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
      {fields.map(field => <div key={field.key} className="min-w-0">
        <label htmlFor={field.key} className="mb-1 block text-sm font-medium text-gray-700">{field.label}{field.key === 'first_name' ? ' *' : ''}</label>
        <input id={field.key} name={field.key} type={field.type || 'text'} required={field.key === 'first_name'} maxLength={field.max} defaultValue={values?.[field.key] || ''} aria-invalid={!!state.fields?.[field.key]} aria-describedby={`${field.key}-error`} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2" />
        <p id={`${field.key}-error`} className="text-sm text-red-700">{state.fields?.[field.key]}</p>
      </div>)}
      <div className="min-w-0">
        <label htmlFor="status" className="mb-1 block text-sm font-medium text-gray-700">Status *</label>
        {converted ? <select id="status" value="CONVERTED" disabled className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2"><option value="CONVERTED">CONVERTED</option></select> : <select id="status" name="status" required defaultValue={values?.status || 'NEW'} aria-invalid={!!state.fields?.status} aria-describedby="status-error" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2">{editableLeadStatuses.map(status => <option key={status} value={status}>{status}</option>)}</select>}
        <p id="status-error" className="text-sm text-red-700">{state.fields?.status}</p>
      </div>
      <div className="min-w-0">
        <label htmlFor="source_id" className="mb-1 block text-sm font-medium text-gray-700">Lead source</label>
        {canViewSources ? <select id="source_id" name="source_id" defaultValue={values?.source_id || ''} aria-invalid={!!state.fields?.source_id} aria-describedby="source_id-error" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"><option value="">No source</option>{sources.map(source => <option key={source.id} value={source.id} disabled={!source.is_active && source.id !== lead?.source_id}>{source.name}{source.is_active ? '' : ' (Inactive)'}</option>)}</select> : <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">You do not have permission to view or change lead sources.</p>}
        <p id="source_id-error" className="text-sm text-red-700">{state.fields?.source_id}</p>
      </div>
      <div className="min-w-0 sm:col-span-2">
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
        <textarea id="notes" name="notes" rows={5} maxLength={10000} defaultValue={values?.notes || ''} aria-invalid={!!state.fields?.notes} aria-describedby="notes-error" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
        <p id="notes-error" className="text-sm text-red-700">{state.fields?.notes}</p>
      </div>
    </fieldset>
    <div className="flex flex-wrap items-center gap-4"><button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{pending ? 'Saving...' : 'Save lead'}</button><Link href={lead ? `/app/leads/${lead.id}` : canViewLeads ? '/app/leads' : '/app/dashboard'} className="text-sm text-gray-600">{state.success ? 'Back' : 'Cancel'}</Link></div>
  </form>
}
