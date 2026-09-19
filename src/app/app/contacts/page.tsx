import Link from 'next/link'
import { getContacts } from '@/server/contacts'
import { ContactsTable } from '@/components/contacts/contacts-table'
import { SearchForm, Pagination } from '@/components/ui/list-controls'
export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const search = typeof params.q === 'string' ? params.q : ''
  const page = params.page === undefined ? 1 : Number(params.page)
  const data = await getContacts(page, search)
  return <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900">Contacts</h1><p className="mt-1 text-sm text-gray-500">People in your workspace</p></div>{data.canManage && <Link href="/app/contacts/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create contact</Link>}</div><SearchForm search={search} /><ContactsTable contacts={data.contacts} canViewCompanies={data.canViewCompanies} /><Pagination path="/app/contacts" page={page} total={data.total} search={search} /></div>
}
