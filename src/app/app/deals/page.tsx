import Link from 'next/link'
import { getDeals, getDealsKanban } from '@/server/deals'
import { DealsTable } from '@/components/deals/deals-table'
import { DealKanban } from '@/components/deals/deal-kanban'
import { Pagination, SearchForm } from '@/components/ui/list-controls'

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; view?: string; pipeline_id?: string }>
}) {
  const params = await searchParams
  const search = typeof params.q === 'string' ? params.q : ''
  const page = params.page === undefined ? 1 : Number(params.page)
  const view = params.view === 'kanban' ? 'kanban' : 'list'
  const pipelineId = typeof params.pipeline_id === 'string' ? params.pipeline_id : undefined

  // Helper for view switcher link preserving query params
  const getViewLink = (targetView: 'list' | 'kanban') => {
    const p = new URLSearchParams()
    if (search) p.set('q', search)
    if (pipelineId) p.set('pipeline_id', pipelineId)
    if (targetView === 'kanban') p.set('view', 'kanban')
    const queryString = p.toString()
    return `/app/deals${queryString ? `?${queryString}` : ''}`
  }

  if (view === 'kanban') {
    const kanbanData = await getDealsKanban(pipelineId, search)
    const canManageKanban = kanbanData.canManage
    return (
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
            <p className="mt-1 text-sm text-gray-500">Sales opportunities in your workspace</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs font-medium">
              <Link
                href={getViewLink('list')}
                className="rounded-md px-3 py-1.5 text-gray-600 transition-colors hover:text-gray-900"
              >
                List
              </Link>
              <Link
                href={getViewLink('kanban')}
                className="rounded-md bg-white px-3 py-1.5 text-gray-900 shadow-sm transition-colors"
              >
                Kanban
              </Link>
            </div>
            {canManageKanban && (
              <Link
                href="/app/deals/new"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
              >
                Create deal
              </Link>
            )}
          </div>
        </div>

        <SearchForm search={search} label="Search deals" placeholder="Search deal name" />

        <DealKanban
          deals={kanbanData.deals}
          pipelines={kanbanData.pipelines}
          activePipeline={kanbanData.activePipeline}
          stages={kanbanData.stages}
          canManage={kanbanData.canManage}
          canViewContacts={kanbanData.canViewContacts}
          canViewCompanies={kanbanData.canViewCompanies}
        />
      </div>
    )
  }

  const listData = await getDeals(page, search)
  const canManageList = listData.canManage
  const empty =
    listData.total > 0
      ? 'No deals on this page. Use pagination to return to an earlier page.'
      : search.trim()
      ? 'No deals match your search.'
      : 'No deals in your workspace yet.'

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <p className="mt-1 text-sm text-gray-500">Sales opportunities in your workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs font-medium">
            <Link
              href={getViewLink('list')}
              className="rounded-md bg-white px-3 py-1.5 text-gray-900 shadow-sm transition-colors"
            >
              List
            </Link>
            <Link
              href={getViewLink('kanban')}
              className="rounded-md px-3 py-1.5 text-gray-600 transition-colors hover:text-gray-900"
            >
              Kanban
            </Link>
          </div>
          {canManageList && (
            <Link
              href="/app/deals/new"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
            >
              Create deal
            </Link>
          )}
        </div>
      </div>

      <SearchForm search={search} label="Search deals" placeholder="Search deal name" />

      <DealsTable
        deals={listData.deals}
        empty={empty}
        canViewPipelines={listData.canViewPipelines}
        canViewContacts={listData.canViewContacts}
        canViewCompanies={listData.canViewCompanies}
      />
      <Pagination path="/app/deals" page={page} total={listData.total} search={search} />
    </div>
  )
}
