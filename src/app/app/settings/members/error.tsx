'use client'

export default function MembersError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-6xl p-6 md:p-12">
    <h1 className="text-2xl font-bold">Workspace Members</h1>
    <p role="alert" className="my-6 text-red-700">Unable to load workspace members.</p>
    <button onClick={reset} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">Try again</button>
  </main>
}
