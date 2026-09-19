'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createCompany, updateCompany } from '@/server/companies'
import type { CompanyFormState } from '@/features/companies/types'

export async function saveCompanyAction(id: string | null, _previous: CompanyFormState, form: FormData): Promise<CompanyFormState> {
  const result = id === null ? await createCompany(form) : await updateCompany(id, form)
  if (!result.id && !result.success) return result
  revalidatePath('/app/companies')
  if (!result.id) return { success: true }
  revalidatePath(`/app/companies/${result.id}`)
  revalidatePath(`/app/companies/${result.id}/edit`)
  // Contact pages also display company names. Invalidate their cached views after a rename.
  if (id !== null) {
    revalidatePath('/app/contacts')
    revalidatePath('/app/contacts/[id]', 'page')
  }
  redirect(`/app/companies/${result.id}`)
}
