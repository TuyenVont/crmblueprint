'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createDeal, updateDeal, updateDealStage } from '@/server/deals'
import type { DealFormState } from '@/features/deals/types'
export async function saveDealAction(id: string | null, _previous: DealFormState, form: FormData): Promise<DealFormState> { const result = id === null ? await createDeal(form) : await updateDeal(id, form); if (!result.id && !result.success) return result; revalidatePath('/app/deals'); if (!result.id) return { success: true }; revalidatePath(`/app/deals/${result.id}`); revalidatePath(`/app/deals/${result.id}/edit`); redirect(`/app/deals/${result.id}`) }

export async function updateDealStageAction(dealId: string, stageId: string) {
  const result = await updateDealStage(dealId, stageId)
  if (result.success) {
    revalidatePath('/app/deals')
  }
  return result
}

