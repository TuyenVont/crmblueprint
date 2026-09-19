'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createLead, updateLead } from '@/server/leads'
import type { LeadFormState } from '@/features/leads/types'

export async function saveLeadAction(id: string | null, _previous: LeadFormState, form: FormData): Promise<LeadFormState> {
  const result = id === null ? await createLead(form) : await updateLead(id, form)
  if (!result.id && !result.success) return result
  revalidatePath('/app/leads')
  if (!result.id) return { success: true }
  revalidatePath(`/app/leads/${result.id}`)
  revalidatePath(`/app/leads/${result.id}/edit`)
  redirect(`/app/leads/${result.id}`)
}
