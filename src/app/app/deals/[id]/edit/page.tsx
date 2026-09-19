import { DealForm } from '@/components/deals/deal-form'
import { getDealForEdit } from '@/server/deals'
export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) { const data = await getDealForEdit((await params).id); return <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8"><h1 className="text-2xl font-bold">Edit deal</h1><DealForm deal={data.deal} options={data.options} currency={data.deal.currency} /></div> }
