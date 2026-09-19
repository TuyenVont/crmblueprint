import { getCompanyForEdit } from '@/server/companies'
import { CompanyForm } from '@/components/companies/company-form'

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const company = await getCompanyForEdit((await params).id)
  return <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8"><h1 className="text-2xl font-bold">Edit company</h1><CompanyForm company={company} /></div>
}
