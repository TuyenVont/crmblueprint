'use client'
import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'
import { saveCompanyAction } from '@/app/app/companies/actions'
import type { Company, CompanyInput } from '@/features/companies/types'

const fields: { key: keyof CompanyInput; label: string; type?: string; max: number }[] = [
  { key: 'name', label: 'Company name', max: 200 }, { key: 'tax_id', label: 'Tax ID', max: 200 },
  { key: 'email', label: 'Email', type: 'email', max: 320 }, { key: 'phone', label: 'Phone', type: 'tel', max: 80 },
  { key: 'website', label: 'Website', type: 'url', max: 2000 }, { key: 'industry', label: 'Industry', max: 200 },
  { key: 'size', label: 'Size', max: 200 }, { key: 'address', label: 'Address', max: 2000 },
]

export function CompanyForm({ company, canView = true }: { company?: Company; canView?: boolean }) {
  const [state, action, pending] = useActionState(saveCompanyAction.bind(null, company?.id || null), {})
  const submitting = useRef(false)
  useEffect(() => { if (!pending) submitting.current = false }, [pending, state])
  return <form action={action} aria-busy={pending} onSubmit={event => {
    // Block a second submit immediately, including before React renders pending UI.
    if (submitting.current || pending) event.preventDefault()
    else submitting.current = true
  }} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-700">Company created successfully.</p>}
    <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
      {fields.map(field => <div key={field.key} className={field.key === 'address' ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
        <label htmlFor={field.key} className="mb-1 block text-sm font-medium text-gray-700">{field.label}{field.key === 'name' ? ' *' : ''}</label>
        {field.key === 'address' ? <textarea id={field.key} name={field.key} rows={3} maxLength={field.max} defaultValue={(state.values || company)?.[field.key] || ''} aria-invalid={!!state.fields?.[field.key]} aria-describedby={`${field.key}-error`} className="w-full rounded-lg border border-gray-300 px-3 py-2" /> : <input id={field.key} name={field.key} type={field.type || 'text'} required={field.key === 'name'} maxLength={field.max} defaultValue={(state.values || company)?.[field.key] || ''} aria-invalid={!!state.fields?.[field.key]} aria-describedby={`${field.key}-error`} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2" />}
        <p id={`${field.key}-error`} className="text-sm text-red-700">{state.fields?.[field.key]}</p>
      </div>)}
    </fieldset>
    <div className="flex flex-wrap items-center gap-4">
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{pending ? 'Saving...' : 'Save company'}</button>
      <Link href={company ? `/app/companies/${company.id}` : canView ? '/app/companies' : '/app/dashboard'} className="text-sm text-gray-600">{state.success ? 'Back' : 'Cancel'}</Link>
    </div>
  </form>
}
