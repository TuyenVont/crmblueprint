import Link from 'next/link'
import { getProductForEdit, productsContext } from '@/server/products'
import { ProductForm } from '@/components/products/product-form'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  const product = await getProductForEdit(id)
  const { permissions } = await productsContext('edit')

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <Link href={`/app/products/${product.id}`} className="text-sm text-indigo-700">
        Back to product
      </Link>
      <h1 className="text-2xl font-bold">Edit product</h1>
      <ProductForm product={product} canView={permissions.has('PRODUCTS_VIEW')} />
    </div>
  )
}
