import { getLeadCreateData } from '@/server/leads'
import { LeadForm } from '@/components/leads/lead-form'

export default async function NewLeadPage() {
  const data = await getLeadCreateData()
  return <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8"><h1 className="text-2xl font-bold">Create lead</h1><LeadForm sources={data.sources} canViewSources={data.canViewSources} canViewLeads={data.canViewLeads} /></div>
}
