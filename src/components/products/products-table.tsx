import Link from 'next/link'
import { DataTable } from '@/components/ui/data-table'
import type { Product } from '@/features/products/types'

function formatPrice(price: string, currency: string) {
  const num = parseFloat(price)
  if (isNaN(num)) return `${currency} ${price}`
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num)} ${currency}`
}

export function ProductsTable({ products, empty }: { products: Product[]; empty: string }) {
  const nameWithThumbnail = (product: Product) => (
    <div className="flex items-center gap-3">
      {product.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={product.image_url}
          alt={product.name}
          className="h-10 w-10 flex-shrink-0 rounded-md border object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-400">
          📦
        </div>
      )}
      <Link className="font-medium text-indigo-700 hover:underline" href={`/app/products/${product.id}`}>
        {product.name}
      </Link>
    </div>
  )

  const status = (product: Product) => (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
      }`}
    >
      {product.is_active ? 'Active' : 'Inactive'}
    </span>
  )

  return (
    <>
      <div className="hidden md:block">
        <DataTable
          rows={products}
          rowKey={(row) => row.id}
          empty={empty}
          columns={[
            { key: 'name', label: 'Name', render: nameWithThumbnail },
            { key: 'sku', label: 'SKU', render: (row) => row.sku || 'Not set' },
            { key: 'unit', label: 'Unit', render: (row) => row.unit || 'Not set' },
            { key: 'price', label: 'Price', render: (row) => formatPrice(row.price, row.currency) },
            { key: 'status', label: 'Status', render: status },
          ]}
        />
      </div>
      <div className="space-y-3 md:hidden">
        {!products.length && <p className="rounded-xl border bg-white p-4 text-gray-500">{empty}</p>}
        {products.map((product) => (
          <article key={product.id} className="space-y-2 break-words rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              {nameWithThumbnail(product)}
              {status(product)}
            </div>
            <p className="text-sm text-gray-600">SKU: {product.sku || 'Not set'}</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatPrice(product.price, product.currency)} {product.unit ? `/ ${product.unit}` : ''}
            </p>
          </article>
        ))}
      </div>
    </>
  )
}
