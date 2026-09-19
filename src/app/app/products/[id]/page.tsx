import Link from 'next/link'
import { getProductById } from '@/server/products'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  const { product: p, canManage } = await getProductById(id)

  const formatPrice = (price: string, currency: string) => {
    const num = parseFloat(price)
    if (isNaN(num)) return `${currency} ${price}`
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num)} ${currency}`
  }

  const values: [string, string | null][] = [
    ['SKU', p.sku],
    ['Unit', p.unit],
    ['Price', formatPrice(p.price, p.currency)],
    ['Status', p.is_active ? 'Active' : 'Inactive'],
    ['Created (UTC)', p.created_at],
    ['Updated (UTC)', p.updated_at],
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <Link href="/app/products" className="text-sm text-indigo-700">
        Back to products
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-bold">{p.name}</h1>
        {canManage && (
          <Link href={`/app/products/${p.id}/edit`} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
            Edit product
          </Link>
        )}
      </div>

      {p.image_url && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-gray-500">Product Image</h2>
          <div className="max-w-md overflow-hidden rounded-lg border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt={p.name} className="max-h-80 w-full object-contain bg-gray-50" />
          </div>
        </div>
      )}

      <dl className="grid gap-5 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
        {values.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm text-gray-500">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-gray-900">{value || 'Not provided'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
