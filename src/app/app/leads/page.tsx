import { getLeads } from '@/server/leads'
import { LeadsTable } from '@/components/leads/leads-table'
import { Pagination, SearchForm } from '@/components/ui/list-controls'
import Link from 'next/link'

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const search = typeof params.q === 'string' ? params.q : ''
  const page = params.page === undefined ? 1 : Number(params.page)
  const data = await getLeads(page, search)
  const empty = data.total > 0
    ? 'No leads on this page. Use pagination to return to an earlier page.'
    : search.trim() ? 'No leads match your search.' : 'No leads in your workspace yet.'
  return <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900">Leads</h1><p className="mt-1 text-sm text-gray-500">Potential customers in your workspace</p></div>{data.canManage && <Link href="/app/leads/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create lead</Link>}</div>
    <SearchForm search={search} label="Search leads" placeholder="Search name, company, email or phone" />
    <LeadsTable leads={data.leads} empty={empty} canViewSources={data.canViewSources} />
    <Pagination path="/app/leads" page={page} total={data.total} search={search} />
  </div>
}
