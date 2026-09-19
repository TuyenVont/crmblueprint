'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { saveContactAction } from '@/app/app/contacts/actions'
import type { Contact, ContactInput } from '@/features/contacts/types'
const fields: { key: keyof ContactInput; label: string; type?: string; max: number }[] = [
  { key: 'first_name', label: 'First name', max: 200 }, { key: 'last_name', label: 'Last name', max: 200 },
  { key: 'email', label: 'Email', type: 'email', max: 320 }, { key: 'phone', label: 'Phone', type: 'tel', max: 80 },
  { key: 'birthday', label: 'Birthday', type: 'date', max: 10 }, { key: 'address', label: 'Address', max: 2000 }, { key: 'notes', label: 'Notes', max: 10000 },
]
export function ContactForm({ contact }: { contact?: Contact }) {
  const [state, action, pending] = useActionState(saveContactAction.bind(null, contact?.id || null), {})
  return <form action={action} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">{fields.map(f => <div key={f.key} className={f.key === 'notes' || f.key === 'address' ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
      <label htmlFor={f.key} className="mb-1 block text-sm font-medium text-gray-700">{f.label}{f.key === 'first_name' ? ' *' : ''}</label>
      {f.key === 'notes' || f.key === 'address' ? <textarea id={f.key} name={f.key} defaultValue={(state.values || contact)?.[f.key] || ''} maxLength={f.max} rows={f.key === 'notes' ? 5 : 2} aria-invalid={!!state.fields?.[f.key]} aria-describedby={`${f.key}-error`} className="w-full rounded-lg border border-gray-300 px-3 py-2" /> : <input id={f.key} name={f.key} type={f.type || 'text'} required={f.key === 'first_name'} maxLength={f.max} defaultValue={(state.values || contact)?.[f.key] || ''} aria-invalid={!!state.fields?.[f.key]} aria-describedby={`${f.key}-error`} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2" />}
      <p id={`${f.key}-error`} className="text-sm text-red-700">{state.fields?.[f.key]}</p>
    </div>)}</fieldset>
    <div className="flex items-center gap-4"><button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{pending ? 'Saving...' : 'Save contact'}</button><Link href={contact ? `/app/contacts/${contact.id}` : '/app/contacts'} className="text-sm text-gray-600">Cancel</Link></div>
  </form>
}
