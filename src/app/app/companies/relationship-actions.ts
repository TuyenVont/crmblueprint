'use server'
import { revalidatePath } from 'next/cache'
import { linkCompanyContact, unlinkCompanyContact } from '@/server/company-contacts'
import type { RelationshipActionState } from '@/server/company-contacts'

export async function linkContactAction(companyId: string, _previous: RelationshipActionState, form: FormData): Promise<RelationshipActionState> {
  const contactId = form.get('contact_id')
  const result = await linkCompanyContact(companyId, typeof contactId === 'string' ? contactId : '')
  if (result.success) {
    revalidatePath(`/app/companies/${companyId}`)
    if (typeof contactId === 'string') revalidatePath(`/app/contacts/${contactId}`)
    revalidatePath('/app/contacts')
  }
  return result
}

export async function unlinkContactAction(companyId: string, _previous: RelationshipActionState, form: FormData): Promise<RelationshipActionState> {
  const contactId = form.get('contact_id')
  const result = await unlinkCompanyContact(companyId, typeof contactId === 'string' ? contactId : '')
  if (result.success) {
    revalidatePath(`/app/companies/${companyId}`)
    if (typeof contactId === 'string') revalidatePath(`/app/contacts/${contactId}`)
    revalidatePath('/app/contacts')
  }
  return result
}
