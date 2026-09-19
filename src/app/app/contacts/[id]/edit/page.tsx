import { getContactById } from '@/server/contacts'
import { ContactForm } from '@/components/contacts/contact-form'
export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { contact } = await getContactById((await params).id, true)
  return <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8"><h1 className="text-2xl font-bold">Edit contact</h1><ContactForm contact={contact} /></div>
}
