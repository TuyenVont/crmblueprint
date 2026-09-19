import { getProducts } from '@/server/products'
import { ProductsTable } from '@/components/products/products-table'
import Link from 'next/link'
import { SearchForm, Pagination } from '@/components/ui/list-controls'

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const search = typeof params.q === 'string' ? params.q : ''
  const page = params.page === undefined ? 1 : Number(params.page)
  const data = await getProducts(page, search)
  const empty =
    data.total > 0
      ? 'No products on this page. Use pagination to return to an earlier page.'
      : search.trim()
      ? 'No products match your search. Try another name or SKU.'
      : 'No products in your workspace yet.'

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">Products catalog in your workspace</p>
        </div>
        {data.canManage && (
          <Link href="/app/products/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
            Create product
          </Link>
        )}
      </div>
      <SearchForm search={search} label="Search products" placeholder="Search by name or SKU" />
      <ProductsTable products={data.products} empty={empty} />
      <Pagination path="/app/products" page={page} total={data.total} search={search} />
    </div>
  )
}
