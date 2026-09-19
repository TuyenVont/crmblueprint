'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createProduct, updateProduct } from '@/server/products'
import type { ProductFormState } from '@/features/products/types'

export async function saveProductAction(
  id: string | null,
  _previous: ProductFormState,
  form: FormData
): Promise<ProductFormState> {
  const result = id === null ? await createProduct(form) : await updateProduct(id, form)
  if (!result.id && !result.success) return result
  revalidatePath('/app/products')
  if (!result.id) return { success: true }
  revalidatePath(`/app/products/${result.id}`)
  revalidatePath(`/app/products/${result.id}/edit`)
  redirect(`/app/products/${result.id}`)
}
