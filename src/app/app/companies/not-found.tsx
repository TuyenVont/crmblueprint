import Link from 'next/link'
export default function CompanyNotFound() { return <div className="space-y-4 p-8"><h1 className="text-xl font-semibold">Company unavailable</h1><p>This page was not found or you do not have access.</p><Link href="/app/dashboard" className="text-indigo-700">Return to dashboard</Link></div> }
