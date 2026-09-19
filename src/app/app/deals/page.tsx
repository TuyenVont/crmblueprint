import Link from 'next/link'
import { getDeals } from '@/server/deals'
import { DealsTable } from '@/components/deals/deals-table'
import { Pagination, SearchForm } from '@/components/ui/list-controls'
export default async function DealsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams; const search = typeof params.q === 'string' ? params.q : ''; const page = params.page === undefined ? 1 : Number(params.page); const data = await getDeals(page, search)
  const empty = data.total > 0 ? 'No deals on this page. Use pagination to return to an earlier page.' : search.trim() ? 'No deals match your search.' : 'No deals in your workspace yet.'
  return <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900">Deals</h1><p className="mt-1 text-sm text-gray-500">Sales opportunities in your workspace</p></div>{data.canManage && <Link href="/app/deals/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create deal</Link>}</div><SearchForm search={search} label="Search deals" placeholder="Search deal name" /><DealsTable deals={data.deals} empty={empty} canViewPipelines={data.canViewPipelines} canViewContacts={data.canViewContacts} canViewCompanies={data.canViewCompanies} /><Pagination path="/app/deals" page={page} total={data.total} search={search} /></div>
}
