import Link from 'next/link'
import { DataTable } from '@/components/ui/data-table'
import type { Company } from '@/features/companies/types'

export function CompaniesTable({ companies, empty }: { companies: Company[]; empty: string }) {
  const name = (company: Company) => <Link className="font-medium text-indigo-700 hover:underline" href={`/app/companies/${company.id}`}>{company.name}</Link>
  return <>
    <div className="hidden md:block"><DataTable rows={companies} rowKey={row => row.id} empty={empty} columns={[
      { key: 'name', label: 'Name', render: name },
      { key: 'email', label: 'Email', render: row => row.email || 'Not provided' },
      { key: 'phone', label: 'Phone', render: row => row.phone || 'Not provided' },
      { key: 'industry', label: 'Industry', render: row => row.industry || 'Not provided' },
      { key: 'created', label: 'Created', render: row => row.created_at.slice(0, 10) },
    ]} /></div>
    <div className="space-y-3 md:hidden">
      {!companies.length && <p className="rounded-xl border bg-white p-4 text-gray-500">{empty}</p>}
      {companies.map(company => <article key={company.id} className="space-y-2 break-words rounded-xl border border-gray-200 bg-white p-4">
        <h2>{name(company)}</h2><p className="text-sm text-gray-600">{company.email || 'No email'}</p><p className="text-sm text-gray-600">{company.phone || 'No phone'}</p><p className="text-sm text-gray-600">{company.industry || 'Industry not provided'}</p>
      </article>)}
    </div>
  </>
}
