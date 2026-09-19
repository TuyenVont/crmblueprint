'use client'

import { useState, useTransition, useActionState } from 'react'
import type { DealItem, ProductOption } from '@/features/deals/deal-items-types'
import { createDealItemAction, deleteDealItemAction, updateDealItemAction } from '@/app/app/deals/items-actions'

interface DealItemsSectionProps {
  dealId: string
  currency: string
  dealItems: DealItem[]
  productOptions: ProductOption[]
  canManage: boolean
  canViewProducts: boolean
}

function formatAmount(val: string | number, currency: string) {
  const num = typeof val === 'number' ? val : parseFloat(val)
  if (isNaN(num)) return `${currency} 0`
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num)} ${currency}`
}

export function DealItemsSection({
  dealId,
  currency,
  dealItems,
  productOptions,
  canManage,
  canViewProducts,
}: DealItemsSectionProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedPrice, setSelectedPrice] = useState<string>('0')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [addState, addAction, addPending] = useActionState(createDealItemAction.bind(null, dealId), {})
  const [prevAddState, setPrevAddState] = useState(addState)

  if (addState !== prevAddState) {
    setPrevAddState(addState)
    if (addState.success) {
      setIsAddOpen(false)
      setSelectedProductId('')
      setSelectedPrice('0')
    }
  }

  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId)
    const found = productOptions.find((p) => p.id === prodId)
    if (found) {
      setSelectedPrice(found.price)
    }
  }

  const handleDelete = (itemId: string) => {
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteDealItemAction(itemId, dealId)
      if (res.error) {
        setDeleteError(res.error)
      }
    })
  }

  const productsTotal = dealItems.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0)

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Products</h2>
          <p className="text-xs text-gray-500">Items and pricing for this deal</p>
        </div>
        {canManage && canViewProducts && (
          <button
            onClick={() => setIsAddOpen(!isAddOpen)}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            {isAddOpen ? 'Cancel' : '+ Add product'}
          </button>
        )}
      </div>

      {deleteError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{deleteError}</div>}

      {/* Add Product Form */}
      {isAddOpen && (
        <form action={addAction} className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Add Product to Deal</h3>
          {addState.error && <p className="text-xs text-red-700">{addState.error}</p>}

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
            <div className="sm:col-span-2">
              <label htmlFor="product_id" className="block text-xs font-medium text-gray-700">
                Select Product *
              </label>
              <select
                id="product_id"
                name="product_id"
                required
                value={selectedProductId}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">-- Choose active product --</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatAmount(p.price, p.currency)})
                  </option>
                ))}
              </select>
              {addState.fields?.product_id && <p className="text-xs text-red-700">{addState.fields.product_id}</p>}
            </div>

            <div>
              <label htmlFor="quantity" className="block text-xs font-medium text-gray-700">
                Quantity *
              </label>
              <input
                id="quantity"
                name="quantity"
                type="text"
                required
                defaultValue="1"
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              />
              {addState.fields?.quantity && <p className="text-xs text-red-700">{addState.fields.quantity}</p>}
            </div>

            <div>
              <label htmlFor="price" className="block text-xs font-medium text-gray-700">
                Price *
              </label>
              <input
                id="price"
                name="price"
                type="text"
                required
                value={selectedPrice}
                onChange={(e) => setSelectedPrice(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              />
              {addState.fields?.price && <p className="text-xs text-red-700">{addState.fields.price}</p>}
            </div>

            <div>
              <label htmlFor="discount" className="block text-xs font-medium text-gray-700">
                Discount
              </label>
              <input
                id="discount"
                name="discount"
                type="text"
                defaultValue="0"
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              />
              {addState.fields?.discount && <p className="text-xs text-red-700">{addState.fields.discount}</p>}
            </div>

            <div>
              <label htmlFor="tax" className="block text-xs font-medium text-gray-700">
                Tax
              </label>
              <input
                id="tax"
                name="tax"
                type="text"
                defaultValue="0"
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              />
              {addState.fields?.tax && <p className="text-xs text-red-700">{addState.fields.tax}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              disabled={addPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {addPending ? 'Adding...' : 'Add product to deal'}
            </button>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Deal Items Table */}
      {!dealItems.length ? (
        <p className="py-4 text-center text-sm text-gray-500">No products added to this deal yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-600">
              <tr>
                <th className="py-2.5 px-3">Image</th>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Price</th>
                <th className="py-2.5 px-3 text-right">Discount</th>
                <th className="py-2.5 px-3 text-right">Tax</th>
                <th className="py-2.5 px-3 text-right">Total</th>
                {canManage && <th className="py-2.5 px-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dealItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  dealId={dealId}
                  currency={currency}
                  canManage={canManage}
                  isEditing={editingItemId === item.id}
                  setEditingItemId={setEditingItemId}
                  onDelete={() => handleDelete(item.id)}
                  isPending={isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Products Total Footer */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-sm font-semibold text-gray-900">
        <span>Products total:</span>
        <span className="text-base text-indigo-700">{formatAmount(productsTotal, currency)}</span>
      </div>
    </section>
  )
}

function ItemRow({
  item,
  dealId,
  currency,
  canManage,
  isEditing,
  setEditingItemId,
  onDelete,
  isPending,
}: {
  item: DealItem
  dealId: string
  currency: string
  canManage: boolean
  isEditing: boolean
  setEditingItemId: (id: string | null) => void
  onDelete: () => void
  isPending: boolean
}) {
  const [editState, editAction, editPending] = useActionState(
    updateDealItemAction.bind(null, item.id, dealId),
    {}
  )
  const [prevEditState, setPrevEditState] = useState(editState)

  if (editState !== prevEditState) {
    setPrevEditState(editState)
    if (editState.success) {
      setEditingItemId(null)
    }
  }

  if (isEditing) {
    return (
      <tr className="bg-amber-50/50">
        <td colSpan={8} className="p-3">
          <form action={editAction} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900">Edit: {item.name_snapshot}</span>
              <button
                type="button"
                onClick={() => setEditingItemId(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
            {editState.error && <p className="text-xs text-red-700">{editState.error}</p>}
            <div className="grid gap-2 sm:grid-cols-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-700">Qty</label>
                <input
                  name="quantity"
                  defaultValue={item.quantity}
                  required
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
                {editState.fields?.quantity && <p className="text-[10px] text-red-700">{editState.fields.quantity}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-700">Price</label>
                <input
                  name="price"
                  defaultValue={item.price}
                  required
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
                {editState.fields?.price && <p className="text-[10px] text-red-700">{editState.fields.price}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-700">Discount</label>
                <input
                  name="discount"
                  defaultValue={item.discount}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
                {editState.fields?.discount && <p className="text-[10px] text-red-700">{editState.fields.discount}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-700">Tax</label>
                <input
                  name="tax"
                  defaultValue={item.tax}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
                {editState.fields?.tax && <p className="text-[10px] text-red-700">{editState.fields.tax}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={editPending}
                className="rounded bg-indigo-600 px-2.5 py-1 text-xs text-white disabled:opacity-50"
              >
                {editPending ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-gray-50/80">
      <td className="py-2.5 px-3">
        {item.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.image_url} alt={item.name_snapshot} className="h-8 w-8 rounded border object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-gray-50 text-xs text-gray-400">
            📦
          </div>
        )}
      </td>
      <td className="py-2.5 px-3 font-medium text-gray-900">
        <div>{item.name_snapshot}</div>
        {item.sku && <div className="text-[11px] text-gray-400">SKU: {item.sku}</div>}
      </td>
      <td className="py-2.5 px-3 text-right font-medium">{item.quantity}</td>
      <td className="py-2.5 px-3 text-right">{formatAmount(item.price, currency)}</td>
      <td className="py-2.5 px-3 text-right text-gray-500">{formatAmount(item.discount, currency)}</td>
      <td className="py-2.5 px-3 text-right text-gray-500">{formatAmount(item.tax, currency)}</td>
      <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{formatAmount(item.total, currency)}</td>
      {canManage && (
        <td className="py-2.5 px-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditingItemId(item.id)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-900"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={onDelete}
              className="text-xs font-medium text-red-600 hover:text-red-900 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </td>
      )}
    </tr>
  )
}
