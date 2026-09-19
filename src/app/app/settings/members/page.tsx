import Link from 'next/link'
import { getMembers } from '@/server/members'
import { MembersTable } from '@/components/settings/members-table'

export default async function MembersPage({ searchParams }: {
  searchParams: Promise<{ page?: string; search?: string }>
}) {
  const params = await searchParams
  const parsed = Number(params.page ?? 1)
  const page = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100000 ? parsed : 1
  let data
  try { data = await getMembers(page, typeof params.search === 'string' ? params.search : '') } catch (error) {
    return <main className="mx-auto max-w-6xl p-6 md:p-12">
      <Link href="/app" className="text-indigo-700 underline">Back to workspace</Link>
      <h1 className="my-6 text-2xl font-bold">Workspace Members</h1>
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {error instanceof Error ? error.message : 'Unable to load workspace members.'}
      </p>
      <Link href="/app/settings/members" className="mt-4 inline-block text-indigo-700 underline">Try again</Link>
    </main>
  }
  return <main className="min-h-screen bg-gray-50 p-4 text-gray-900 md:p-10">
    <div className="mx-auto max-w-6xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-gray-600"><Link href="/app" className="text-indigo-700 hover:underline">{data.workspaceName}</Link> / Settings / Members</nav>
      <header><h1 className="text-2xl font-bold">Workspace Members</h1><p className="mt-2 text-sm text-gray-600">View membership and manage workspace access.</p></header>
      <form action="/app/settings/members" className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Search members
          <input type="search" name="search" defaultValue={data.search} maxLength={200} placeholder="Name or email" className="mt-2 block rounded-lg border border-gray-300 bg-white px-3 py-2" />
        </label>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Search</button>
      </form>
      <MembersTable data={data} />
    </div>
  </main>
}
