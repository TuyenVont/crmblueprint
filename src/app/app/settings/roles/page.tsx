import Link from 'next/link'
import { getRolesData } from '@/server/roles'
import { RolesView } from '@/components/settings/roles-view'

export default async function RolesPage() {
  let data
  try {
    data = await getRolesData()
  } catch (error) {
    const isForbidden = error instanceof Error && error.message === 'FORBIDDEN'
    return (
      <main className="mx-auto max-w-6xl p-6 md:p-12">
        <Link href="/app" className="text-indigo-700 underline">
          Back to workspace
        </Link>
        <h1 className="my-6 text-2xl font-bold">Roles & Permissions</h1>
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {isForbidden
            ? 'Access Denied: You do not have permission to view roles and permissions.'
            : error instanceof Error
              ? error.message
              : 'Unable to load roles and permissions.'}
        </p>
        {!isForbidden && (
          <Link href="/app/settings/roles" className="mt-4 inline-block text-indigo-700 underline">
            Try again
          </Link>
        )}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <nav aria-label="Breadcrumb" className="text-sm text-gray-600">
          <Link href="/app" className="text-indigo-700 hover:underline">
            {data.workspaceName}
          </Link>{' '}
          / Settings / Roles
        </nav>
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-gray-600">
            View workspace roles and their associated permission configurations.
          </p>
        </header>

        <RolesView data={data} />
      </div>
    </main>
  )
}
