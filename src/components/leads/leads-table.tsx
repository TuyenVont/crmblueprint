import Link from 'next/link'
import { DataTable } from '@/components/ui/data-table'
import type { Lead } from '@/features/leads/types'

function leadName(lead: Lead) {
  return <Link className="font-medium text-indigo-700 hover:underline" href={`/app/leads/${lead.id}`}>{lead.first_name} {lead.last_name}</Link>
}

function sourceLabel(lead: Lead, canViewSources: boolean) {
  return canViewSources ? lead.source_name || 'No source' : 'Unavailable'
}

export function LeadsTable({ leads, empty, canViewSources }: { leads: Lead[]; empty: string; canViewSources: boolean }) {
  return <>
    <div className="hidden md:block"><DataTable rows={leads} rowKey={lead => lead.id} empty={empty} columns={[
      { key: 'name', label: 'Name', render: leadName },
      { key: 'company', label: 'Company', render: lead => lead.company_name || 'Not provided' },
      { key: 'email', label: 'Email', render: lead => lead.email || 'Not provided' },
      { key: 'phone', label: 'Phone', render: lead => lead.phone || 'Not provided' },
      { key: 'status', label: 'Status', render: lead => lead.status },
      { key: 'source', label: 'Source', render: lead => sourceLabel(lead, canViewSources) },
    ]} /></div>
    <div className="space-y-3 md:hidden">
      {!leads.length && <p className="rounded-xl border bg-white p-4 text-gray-500">{empty}</p>}
      {leads.map(lead => <article key={lead.id} className="space-y-2 break-words rounded-xl border border-gray-200 bg-white p-4">
        <h2>{leadName(lead)}</h2>
        <p className="text-sm text-gray-600">{lead.company_name || 'Company not provided'}</p>
        <p className="text-sm text-gray-600">{lead.email || 'No email'}</p>
        <p className="text-sm text-gray-600">{lead.phone || 'No phone'}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600"><span>{lead.status}</span><span>{sourceLabel(lead, canViewSources)}</span></div>
      </article>)}
    </div>
  </>
}
