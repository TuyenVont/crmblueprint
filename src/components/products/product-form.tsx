'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { saveProductAction } from '@/app/app/products/actions'
import type { Product, ProductInput } from '@/features/products/types'

export function ProductForm({ product, canView = true }: { product?: Product; canView?: boolean }) {
  const [state, action, pending] = useActionState(saveProductAction.bind(null, product?.id || null), {})
  const submitting = useRef(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!pending) submitting.current = false
  }, [pending, state])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setSelectedFile(file)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    if (file) {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
  }

  const getValue = (key: keyof ProductInput) => {
    if (state.values && key in state.values) {
      return state.values[key] ?? ''
    }
    if (product && key in product) {
      return product[key] ?? ''
    }
    if (key === 'price') return '0'
    if (key === 'currency') return 'VND'
    return ''
  }

  const getIsActive = () => {
    if (state.values && 'is_active' in state.values) {
      return Boolean(state.values.is_active)
    }
    if (product && 'is_active' in product) {
      return Boolean(product.is_active)
    }
    return true
  }

  const currentImageUrl = String(getValue('image_url'))
  const displayPreview = previewUrl || currentImageUrl || null

  return (
    <form
      action={action}
      aria-busy={pending}
      onSubmit={(event) => {
        if (submitting.current || pending) event.preventDefault()
        else submitting.current = true
      }}
      className="space-y-5 rounded-xl border border-gray-200 bg-white p-5"
    >
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-green-700">
          Product created successfully.
        </p>
      )}

      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0 sm:col-span-2">
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
            Product name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={200}
            defaultValue={String(getValue('name'))}
            aria-invalid={!!state.fields?.name}
            aria-describedby="name-error"
            className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2"
          />
          <p id="name-error" className="text-sm text-red-700">
            {state.fields?.name}
          </p>
        </div>

        <div className="min-w-0">
          <label htmlFor="sku" className="mb-1 block text-sm font-medium text-gray-700">
            SKU
          </label>
          <input
            id="sku"
            name="sku"
            type="text"
            maxLength={100}
            defaultValue={String(getValue('sku'))}
            aria-invalid={!!state.fields?.sku}
            aria-describedby="sku-error"
            className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2"
          />
          <p id="sku-error" className="text-sm text-red-700">
            {state.fields?.sku}
          </p>
        </div>

        <div className="min-w-0">
          <label htmlFor="unit" className="mb-1 block text-sm font-medium text-gray-700">
            Unit
          </label>
          <input
            id="unit"
            name="unit"
            type="text"
            maxLength={50}
            placeholder="e.g. pcs, kg, hours"
            defaultValue={String(getValue('unit'))}
            aria-invalid={!!state.fields?.unit}
            aria-describedby="unit-error"
            className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2"
          />
          <p id="unit-error" className="text-sm text-red-700">
            {state.fields?.unit}
          </p>
        </div>

        <div className="min-w-0">
          <label htmlFor="price" className="mb-1 block text-sm font-medium text-gray-700">
            Price *
          </label>
          <input
            id="price"
            name="price"
            type="text"
            required
            maxLength={100}
            defaultValue={String(getValue('price'))}
            aria-invalid={!!state.fields?.price}
            aria-describedby="price-error"
            className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2"
          />
          <p id="price-error" className="text-sm text-red-700">
            {state.fields?.price}
          </p>
        </div>

        <div className="min-w-0">
          <label htmlFor="currency" className="mb-1 block text-sm font-medium text-gray-700">
            Currency *
          </label>
          <input
            id="currency"
            name="currency"
            type="text"
            required
            maxLength={10}
            defaultValue={String(getValue('currency'))}
            aria-invalid={!!state.fields?.currency}
            aria-describedby="currency-error"
            className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2"
          />
          <p id="currency-error" className="text-sm text-red-700">
            {state.fields?.currency}
          </p>
        </div>

        {/* Product Image File Selection */}
        <div className="min-w-0 sm:col-span-2 space-y-2">
          <label htmlFor="image_file" className="block text-sm font-medium text-gray-700">
            Product image
          </label>

          {displayPreview && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayPreview}
                alt="Product preview"
                className="h-20 w-20 rounded-lg border object-cover shadow-sm"
              />
              <div className="text-xs text-gray-500">
                {selectedFile ? (
                  <>
                    <p className="font-medium text-gray-700">{selectedFile.name}</p>
                    <p>{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </>
                ) : (
                  <p>Current image preview</p>
                )}
              </div>
            </div>
          )}

          <input
            id="image_file"
            name="image_file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            aria-invalid={!!state.fields?.image_url}
            aria-describedby="image_file-error"
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <p className="text-xs text-gray-500">Supported formats: JPEG, PNG, WebP (Max size: 5 MB)</p>
          <p id="image_file-error" className="text-sm text-red-700">
            {state.fields?.image_url}
          </p>

          {/* Hidden or optional image_url for keeping existing path */}
          <input type="hidden" name="image_url" value={currentImageUrl} />
        </div>

        <div className="min-w-0 sm:col-span-2 flex items-center gap-2 pt-2">
          <input
            id="is_active"
            name="is_active"
            type="checkbox"
            value="true"
            defaultChecked={getIsActive()}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Active product
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
          {pending ? 'Saving...' : 'Save product'}
        </button>
        <Link
          href={product ? `/app/products/${product.id}` : canView ? '/app/products' : '/app/dashboard'}
          className="text-sm text-gray-600"
        >
          {state.success ? 'Back' : 'Cancel'}
        </Link>
      </div>
    </form>
  )
}
