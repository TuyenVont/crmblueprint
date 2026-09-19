'use server'

import { revalidatePath } from 'next/cache'
import { createDealItem, deleteDealItem, updateDealItem } from '@/server/deal-items'
import type { DealItemFormState } from '@/features/deals/deal-items-types'

export async function createDealItemAction(
  dealId: string,
  _previous: DealItemFormState,
  form: FormData
): Promise<DealItemFormState> {
  const result = await createDealItem(dealId, form)
  if (result.success || result.id) {
    revalidatePath(`/app/deals/${dealId}`)
    return { success: true }
  }
  return result
}

export async function updateDealItemAction(
  dealItemId: string,
  dealId: string,
  _previous: DealItemFormState,
  form: FormData
): Promise<DealItemFormState> {
  const result = await updateDealItem(dealItemId, form)
  if (result.success || result.id) {
    revalidatePath(`/app/deals/${dealId}`)
    return { success: true }
  }
  return result
}

export async function deleteDealItemAction(
  dealItemId: string,
  dealId: string
): Promise<{ success?: boolean; error?: string }> {
  const result = await deleteDealItem(dealItemId)
  if (result.success) {
    revalidatePath(`/app/deals/${dealId}`)
  }
  return result
}
