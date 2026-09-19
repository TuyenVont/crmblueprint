export default function Loading() {
  return <main className="mx-auto max-w-6xl p-6 md:p-12" aria-busy="true">
    <h1 className="text-2xl font-bold">Workspace Members</h1>
    <p role="status" className="mt-6 text-gray-600">Loading members…</p>
  </main>
}
