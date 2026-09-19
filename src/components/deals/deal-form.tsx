'use client'
import Link from 'next/link'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { saveDealAction } from '@/app/app/deals/actions'
import type { DealFormDeal, DealFormOptions } from '@/features/deals/types'
export function DealForm({ deal, options, currency, canViewDeals = true }: { deal?: DealFormDeal; options: DealFormOptions; currency: string; canViewDeals?: boolean }) {
  const defaultPipeline = deal?.pipeline_id || options.pipelines.find(item => item.is_default)?.id || options.pipelines[0]?.id || ''
  const [pipelineId, setPipelineId] = useState(defaultPipeline)
  const stages = useMemo(() => options.stages.filter(stage => stage.pipeline_id === pipelineId), [options.stages, pipelineId])
  const [stageId, setStageId] = useState(deal?.stage_id || stages[0]?.id || '')
  const [state, action, pending] = useActionState(saveDealAction.bind(null, deal?.id || null), {})
  const submitting = useRef(false)
  useEffect(() => { if (!pending) submitting.current = false }, [pending, state])
  const values = state.values || deal
  const inputClass = 'w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2'
  const fieldError = (key: keyof NonNullable<typeof state.fields>) => <p id={`${key}-error`} className="text-sm text-red-700">{state.fields?.[key]}</p>
  return <form action={action} aria-busy={pending} onSubmit={event => { if (submitting.current || pending) event.preventDefault(); else submitting.current = true }} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-sm text-green-700">Deal created successfully.</p>}
    <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="min-w-0 sm:col-span-2"><label htmlFor="name" className="mb-1 block text-sm font-medium">Deal name *</label><input id="name" name="name" required maxLength={200} defaultValue={values?.name || ''} aria-invalid={!!state.fields?.name} aria-describedby="name-error" className={inputClass} />{fieldError('name')}</div>
      <div className="min-w-0"><label htmlFor="amount" className="mb-1 block text-sm font-medium">Value ({currency}) *</label><input id="amount" name="amount" required inputMode="decimal" maxLength={100} defaultValue={values?.amount || '0'} aria-invalid={!!state.fields?.amount} aria-describedby="amount-error" className={inputClass} />{fieldError('amount')}</div>
      <div className="min-w-0"><label htmlFor="expected_close_date" className="mb-1 block text-sm font-medium">Expected close date</label><input id="expected_close_date" name="expected_close_date" type="date" defaultValue={values?.expected_close_date || ''} aria-invalid={!!state.fields?.expected_close_date} aria-describedby="expected_close_date-error" className={inputClass} />{fieldError('expected_close_date')}</div>
      <div className="min-w-0"><label htmlFor="pipeline_id" className="mb-1 block text-sm font-medium">Pipeline *</label>{options.canViewPipelines ? <select id="pipeline_id" name="pipeline_id" required value={pipelineId} onChange={event => { const next = event.target.value; setPipelineId(next); setStageId(options.stages.find(stage => stage.pipeline_id === next)?.id || '') }} className={inputClass}><option value="">Select pipeline</option>{options.pipelines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">You do not have permission to view pipelines. Existing values will be preserved.</p>}{fieldError('pipeline_id')}</div>
      <div className="min-w-0"><label htmlFor="stage_id" className="mb-1 block text-sm font-medium">Stage *</label>{options.canViewPipelines ? <select id="stage_id" name="stage_id" required value={stageId} onChange={event => setStageId(event.target.value)} className={inputClass}><option value="">Select stage</option>{stages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">Unavailable without pipeline access.</p>}{fieldError('stage_id')}</div>
      <div className="min-w-0"><label htmlFor="company_id" className="mb-1 block text-sm font-medium">Company</label>{options.canViewCompanies ? <select id="company_id" name="company_id" defaultValue={values?.company_id || ''} className={inputClass}><option value="">No company</option>{options.companies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">You do not have permission to view or change companies.</p>}{fieldError('company_id')}</div>
      <div className="min-w-0"><label htmlFor="contact_id" className="mb-1 block text-sm font-medium">Contact</label>{options.canViewContacts ? <select id="contact_id" name="contact_id" defaultValue={values?.contact_id || ''} className={inputClass}><option value="">No contact</option>{options.contacts.map(item => <option key={item.id} value={item.id}>{[item.first_name, item.last_name].filter(Boolean).join(' ')}</option>)}</select> : <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">You do not have permission to view or change contacts.</p>}{fieldError('contact_id')}</div>
    </fieldset>
    <div className="flex flex-wrap items-center gap-4"><button disabled={pending || (!deal && !options.canViewPipelines)} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{pending ? 'Saving...' : 'Save deal'}</button><Link href={deal ? `/app/deals/${deal.id}` : canViewDeals ? '/app/deals' : '/app/dashboard'} className="text-sm text-gray-600">{state.success ? 'Back' : 'Cancel'}</Link></div>
  </form>
}
