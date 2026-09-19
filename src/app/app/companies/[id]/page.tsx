import Link from 'next/link'
import { getCompanyById } from '@/server/companies'
import { searchContactsForCompany } from '@/server/company-contacts'
import { Pagination } from '@/components/ui/list-controls'
import { LinkContactButton, UnlinkContactButton } from '@/components/companies/company-contact-actions'

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; add?: string; contact_q?: string; contact_page?: string }> }) {
  const query = await searchParams
  const page = query.page === undefined ? 1 : Number(query.page)
  const id = (await params).id
  const { company: c, canViewContacts, contacts, contactsTotal, canManage, canManageRelationships } = await getCompanyById(id, page)
  const pickerOpen = query.add === '1' && canManageRelationships
  const contactSearch = typeof query.contact_q === 'string' ? query.contact_q : ''
  const contactPage = query.contact_page === undefined ? 1 : Number(query.contact_page)
  const picker = pickerOpen ? await searchContactsForCompany(id, contactPage, contactSearch) : null
  const values = [['Tax ID', c.tax_id], ['Email', c.email], ['Phone', c.phone], ['Website', c.website], ['Address', c.address], ['Industry', c.industry], ['Size', c.size], ['Owner user ID', c.owner_user_id], ['Created (UTC)', c.created_at], ['Updated (UTC)', c.updated_at]]
  return <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
    <Link href="/app/companies" className="text-sm text-indigo-700">Back to companies</Link>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="min-w-0 break-words text-2xl font-bold">{c.name}</h1>{canManage && <Link href={`/app/companies/${c.id}/edit`} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Edit company</Link>}</div>
    <dl className="grid gap-5 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-gray-900">{value || 'Not provided'}</dd></div>)}</dl>
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Linked contacts</h2>{canManageRelationships && <Link href={pickerOpen ? `/app/companies/${c.id}` : `/app/companies/${c.id}?add=1`} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-700">{pickerOpen ? 'Close picker' : 'Add contact'}</Link>}</div>
      {!canViewContacts ? <p className="text-sm text-gray-500">You do not have permission to view linked contacts.</p> : <>
        {pickerOpen && picker && <div className="space-y-3 rounded-lg bg-gray-50 p-4">
          <form className="flex flex-wrap gap-2" role="search"><input type="hidden" name="add" value="1" /><label htmlFor="contact-picker-search" className="sr-only">Search contacts</label><input id="contact-picker-search" name="contact_q" defaultValue={contactSearch} maxLength={200} placeholder="Search name, email or phone" className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2" /><button className="rounded-lg border border-gray-300 bg-white px-4 py-2">Search</button></form>
          {picker.error && <p role="alert" className="text-sm text-red-700">{picker.error}</p>}
          {!picker.error && (picker.contacts.length ? <ul className="divide-y divide-gray-200">{picker.contacts.map(contact => <li key={contact.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words font-medium">{contact.first_name} {contact.last_name}</p><p className="break-words text-sm text-gray-600">{contact.email || contact.phone || 'No email or phone'}</p></div><LinkContactButton companyId={c.id} contactId={contact.id} /></li>)}</ul> : <p className="text-sm text-gray-500">No contacts found.</p>)}
          {!picker.error && <nav aria-label="Contact search pagination" className="flex flex-wrap items-center gap-4 text-sm"><span>{picker.total} results / Page {contactPage} of {Math.max(1, Math.ceil(picker.total / 20))}</span>{contactPage > 1 && <Link className="text-indigo-700 underline" href={`/app/companies/${c.id}?${new URLSearchParams({ add: '1', contact_q: contactSearch, contact_page: String(contactPage - 1) })}`}>Previous</Link>}{contactPage * 20 < picker.total && <Link className="text-indigo-700 underline" href={`/app/companies/${c.id}?${new URLSearchParams({ add: '1', contact_q: contactSearch, contact_page: String(contactPage + 1) })}`}>Next</Link>}</nav>}
        </div>}
        {contacts.length ? <ul className="divide-y divide-gray-100">{contacts.map(link => <li key={link.contacts.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0 break-words"><Link href={`/app/contacts/${link.contacts.id}`} className="font-medium text-indigo-700 hover:underline">{link.contacts.first_name} {link.contacts.last_name}</Link>
          {link.job_title && <p className="text-sm text-gray-600">{link.job_title}</p>}
          {link.is_primary && <p className="text-sm text-gray-600">Primary contact</p>}
          <p className="text-sm text-gray-600">{link.contacts.email || 'No email'}</p><p className="text-sm text-gray-600">{link.contacts.phone || 'No phone'}</p></div>
          {canManageRelationships && <UnlinkContactButton companyId={c.id} contactId={link.contacts.id} />}
        </li>)}</ul> : <p className="text-sm text-gray-500">{contactsTotal ? 'No linked contacts on this page. Return to an earlier page.' : 'No linked contacts.'}</p>}
        <Pagination path={`/app/companies/${c.id}`} page={page} total={contactsTotal} search="" />
      </>}
    </section>
  </div>
}
