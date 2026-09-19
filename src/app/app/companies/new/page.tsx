import { companiesContext } from '@/server/companies'
import { CompanyForm } from '@/components/companies/company-form'

export default async function NewCompanyPage() {
  const { permissions } = await companiesContext('create')
  return <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8"><h1 className="text-2xl font-bold">Create company</h1><CompanyForm canView={permissions.has('COMPANIES_VIEW')} /></div>
}
