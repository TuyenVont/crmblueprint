import { DealForm } from '@/components/deals/deal-form'
import { getDealCreateData } from '@/server/deals'
export default async function NewDealPage() { const data = await getDealCreateData(); return <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8"><h1 className="text-2xl font-bold">Create deal</h1><DealForm options={data.options} currency={data.currency} canViewDeals={data.canViewDeals} /></div> }
