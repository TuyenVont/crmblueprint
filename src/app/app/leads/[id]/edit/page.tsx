import { getLeadForEdit } from '@/server/leads'
import { LeadForm } from '@/components/leads/lead-form'

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await getLeadForEdit((await params).id)
  return <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8"><h1 className="text-2xl font-bold">Edit lead</h1><LeadForm lead={data.lead} sources={data.sources} canViewSources={data.canViewSources} /></div>
}
