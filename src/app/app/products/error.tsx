'use client'
import Link from 'next/link'

export default function ProductsError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4 p-8">
      <h2 className="text-lg font-semibold">Unable to load products</h2>
      <p>Please check your search or try again.</p>
      <button onClick={reset} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">
        Try again
      </button>
      <Link href="/app/products" className="ml-4 text-indigo-700">
        Back to products
      </Link>
    </div>
  )
}
