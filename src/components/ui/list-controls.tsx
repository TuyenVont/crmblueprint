import Link from 'next/link'
export function SearchForm({ search, label = 'Search contacts', placeholder = 'Search name, email or phone' }: { search: string; label?: string; placeholder?: string }) {
  return <form className="flex flex-wrap gap-2" role="search"><label htmlFor="list-search" className="sr-only">{label}</label><input id="list-search" name="q" defaultValue={search} maxLength={200} placeholder={placeholder} className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2" /><button className="rounded-lg border border-gray-300 bg-white px-4 py-2">Search</button></form>
}
export function Pagination({ page, total, search, path }: { page: number; total: number; search: string; path: string }) {
  const pages = Math.max(1, Math.ceil(total / 50))
  const href = (value: number) => `${path}?${new URLSearchParams({ q: search, page: String(value) })}`
  return <nav aria-label="Pagination" className="flex flex-wrap items-center gap-4 text-sm"><span>{total} results / Page {page} of {pages}</span>{page > 1 && <Link className="text-indigo-700 underline" href={href(page - 1)}>Previous</Link>}{page < pages && <Link className="text-indigo-700 underline" href={href(page + 1)}>Next</Link>}{page > pages && <Link className="text-indigo-700 underline" href={href(1)}>First page</Link>}</nav>
}
