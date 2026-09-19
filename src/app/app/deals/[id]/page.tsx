import Link from 'next/link'
import { getDealById } from '@/server/deals'
import { getDealItems, getDealProductOptions } from '@/server/deal-items'
import { DealItemsSection } from '@/components/deals/deal-items-section'

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  const data = await getDealById(id)
  const { deal } = data

  const { dealItems, canViewProducts } = await getDealItems(id)
  const productOptions = canViewProducts ? await getDealProductOptions() : []

  const values: [string, string | null][] = [
    ['Deal Amount', `${deal.amount} ${deal.currency}`],
    ['Pipeline', data.canViewPipelines ? deal.pipeline_name : 'You do not have permission to view pipelines.'],
    ['Stage', data.canViewPipelines ? deal.stage_name : 'You do not have permission to view stages.'],
    ['Company', data.canViewCompanies ? deal.company_name : 'You do not have permission to view companies.'],
    ['Contact', data.canViewContacts ? deal.contact_name : 'You do not have permission to view contacts.'],
    ['Expected close date', deal.expected_close_date],
    ['Created (UTC)', deal.created_at],
    ['Updated (UTC)', deal.updated_at],
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <Link href="/app/deals" className="text-sm text-indigo-700">
        Back to deals
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="break-words text-2xl font-bold">{deal.name}</h1>
        {data.canManage && (
          <Link href={`/app/deals/${deal.id}/edit`} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
            Edit deal
          </Link>
        )}
      </div>
      <dl className="grid gap-5 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
        {values.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm text-gray-500">{label}</dt>
            <dd className="mt-1 break-words text-gray-900">{value || 'Not provided'}</dd>
          </div>
        ))}
      </dl>

      <DealItemsSection
        dealId={deal.id}
        currency={deal.currency}
        dealItems={dealItems}
        productOptions={productOptions}
        canManage={data.canManage}
        canViewProducts={canViewProducts}
      />
    </div>
  )
}
