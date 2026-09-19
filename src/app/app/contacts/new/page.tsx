import { contactsContext } from '@/server/contacts'
import { ContactForm } from '@/components/contacts/contact-form'
export default async function NewContactPage() {
  await contactsContext(true)
  return <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8"><h1 className="text-2xl font-bold">Create contact</h1><ContactForm /></div>
}
