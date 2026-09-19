import Link from 'next/link'
import { getDashboardData } from '@/server/dashboard'

function formatAmount(num: number | null, currency: string) {
  if (num === null) return 'N/A'
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num)} ${currency}`
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const { kpis, stagesBreakdown, recentDeals, permissions } = data

  const kpiCards = [
    {
      title: 'Total Contacts',
      value: kpis.totalContacts !== null ? kpis.totalContacts.toLocaleString() : 'Unavailable',
      href: '/app/contacts',
      permitted: permissions.canViewContacts,
      icon: '👥',
    },
    {
      title: 'Total Companies',
      value: kpis.totalCompanies !== null ? kpis.totalCompanies.toLocaleString() : 'Unavailable',
      href: '/app/companies',
      permitted: permissions.canViewCompanies,
      icon: '🏢',
    },
    {
      title: 'Open Leads',
      value: kpis.openLeads !== null ? kpis.openLeads.toLocaleString() : 'Unavailable',
      href: '/app/leads',
      permitted: permissions.canViewLeads,
      icon: '🎯',
    },
    {
      title: 'Open Deals',
      value: kpis.openDeals !== null ? kpis.openDeals.toLocaleString() : 'Unavailable',
      href: '/app/deals',
      permitted: permissions.canViewDeals,
      icon: '💼',
    },
    {
      title: 'Open Pipeline Value',
      value: formatAmount(kpis.openPipelineValue, kpis.currency),
      href: '/app/deals',
      permitted: permissions.canViewDeals,
      icon: '💰',
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Business overview for your workspace</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((card) => (
          <div
            key={card.title}
            className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-500">{card.title}</span>
              <span className="text-base">{card.icon}</span>
            </div>
            <div className="mt-3">
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
            </div>
            {card.permitted ? (
              <Link href={card.href} className="mt-3 text-xs font-medium text-indigo-600 hover:underline">
                View all &rarr;
              </Link>
            ) : (
              <span className="mt-3 text-xs text-gray-400">No view permission</span>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Deals by Stage */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Deals by Stage</h2>
            {permissions.canViewDeals && (
              <Link href="/app/deals?view=kanban" className="text-xs font-medium text-indigo-600 hover:underline">
                Kanban view &rarr;
              </Link>
            )}
          </div>

          {!permissions.canViewDeals ? (
            <p className="py-4 text-sm text-gray-500">You do not have permission to view deals.</p>
          ) : !permissions.canViewPipelines ? (
            <p className="py-4 text-sm text-gray-500">Pipeline details are unavailable without pipeline permission.</p>
          ) : !stagesBreakdown.length ? (
            <p className="py-4 text-sm text-gray-500">No stages configured in default pipeline.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-600">
                  <tr>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3 text-center">Type</th>
                    <th className="py-2.5 px-3 text-right">Deals</th>
                    <th className="py-2.5 px-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stagesBreakdown.map((st) => (
                    <tr key={st.id} className="hover:bg-gray-50/80">
                      <td className="py-2.5 px-3 font-medium text-gray-900">{st.name}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            st.type === 'OPEN'
                              ? 'bg-blue-100 text-blue-800'
                              : st.type === 'WON'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {st.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">{st.count}</td>
                      <td className="py-2.5 px-3 text-right text-gray-700">
                        {formatAmount(st.totalValue, kpis.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Deals */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Deals</h2>
            {permissions.canViewDeals && (
              <Link href="/app/deals" className="text-xs font-medium text-indigo-600 hover:underline">
                All deals &rarr;
              </Link>
            )}
          </div>

          {!permissions.canViewDeals ? (
            <p className="py-4 text-sm text-gray-500">You do not have permission to view deals.</p>
          ) : !recentDeals.length ? (
            <p className="py-4 text-sm text-gray-500">No deals in your workspace yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-600">
                  <tr>
                    <th className="py-2.5 px-3">Deal</th>
                    <th className="py-2.5 px-3">Stage / Company</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentDeals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-gray-50/80">
                      <td className="py-2.5 px-3 font-medium">
                        <Link href={`/app/deals/${deal.id}`} className="text-indigo-700 hover:underline">
                          {deal.name}
                        </Link>
                        <div className="text-[11px] text-gray-400">{deal.created_at}</div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-600">
                        <div>{deal.stage_name || 'Stage N/A'}</div>
                        {deal.company_name && <div className="text-gray-400">{deal.company_name}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-gray-900">
                        {formatAmount(parseFloat(deal.amount) || 0, deal.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
