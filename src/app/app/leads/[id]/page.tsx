import Link from 'next/link'
import { getLeadById } from '@/server/leads'

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { lead, canViewSources, canManage } = await getLeadById((await params).id)
  const values = [
    ['Email', lead.email], ['Phone', lead.phone], ['Company', lead.company_name], ['Status', lead.status],
    ['Source', canViewSources ? lead.source_name || 'No source' : 'You do not have permission to view lead sources.'],
    ['Notes', lead.notes], ['Created (UTC)', lead.created_at], ['Updated (UTC)', lead.updated_at],
  ]
  return <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
    <Link href="/app/leads" className="text-sm text-indigo-700">Back to leads</Link>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="break-words text-2xl font-bold">{lead.first_name} {lead.last_name}</h1>{canManage && <Link href={`/app/leads/${lead.id}/edit`} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Edit lead</Link>}</div>
    <dl className="grid gap-5 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className={label === 'Notes' ? 'min-w-0 sm:col-span-2' : 'min-w-0'}><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-gray-900">{value || 'Not provided'}</dd></div>)}</dl>
  </div>
}
