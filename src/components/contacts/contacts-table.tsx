import Link from 'next/link'
import { DataTable } from '@/components/ui/data-table'
import type { Contact } from '@/features/contacts/types'
export function ContactsTable({ contacts, canViewCompanies }: { contacts: Contact[]; canViewCompanies: boolean }) {
  const name = (c: Contact) => <Link className="font-medium text-indigo-700 hover:underline" href={`/app/contacts/${c.id}`}>{c.first_name} {c.last_name}</Link>
  return <><div className="hidden md:block"><DataTable rows={contacts} rowKey={r => r.id} empty="No contacts found. Create a contact or adjust your search." columns={[
    { key: 'name', label: 'Name', render: name }, { key: 'email', label: 'Email', render: r => r.email || 'Not provided' }, { key: 'phone', label: 'Phone', render: r => r.phone || 'Not provided' },
    ...(canViewCompanies ? [{ key: 'companies', label: 'Companies', render: (r: Contact) => r.companies.map(c => c.name).join(', ') || 'Not provided' }] : []),
    { key: 'created', label: 'Created', render: r => r.created_at.slice(0, 10) },
  ]} /></div><div className="space-y-3 md:hidden">{!contacts.length && <p className="p-4 text-gray-500">No contacts found. Create a contact or adjust your search.</p>}{contacts.map(c => <article key={c.id} className="space-y-2 break-words rounded-xl border border-gray-200 bg-white p-4"><h2>{name(c)}</h2><p className="text-sm text-gray-600">{c.email || 'No email'}</p><p className="text-sm text-gray-600">{c.phone || 'No phone'}</p>{canViewCompanies && <p className="text-sm text-gray-600">{c.companies.map(x => x.name).join(', ') || 'No linked company'}</p>}</article>)}</div></>
}
