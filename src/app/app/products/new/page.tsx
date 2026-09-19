import { productsContext } from '@/server/products'
import { ProductForm } from '@/components/products/product-form'

export default async function NewProductPage() {
  const { permissions } = await productsContext('create')
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Create product</h1>
      <ProductForm canView={permissions.has('PRODUCTS_VIEW')} />
    </div>
  )
}
