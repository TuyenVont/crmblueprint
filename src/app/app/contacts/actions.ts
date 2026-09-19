'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createContact, updateContact } from '@/server/contacts'
import type { ContactFormState } from '@/features/contacts/types'
export async function saveContactAction(id: string | null, _previous: ContactFormState, form: FormData): Promise<ContactFormState> {
  const result = id === null ? await createContact(form) : await updateContact(id, form)
  if (!result.id) return result
  revalidatePath('/app/contacts')
  revalidatePath(`/app/contacts/${result.id}`)
  redirect(`/app/contacts/${result.id}`)
}
