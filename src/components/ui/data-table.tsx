import type { ReactNode } from 'react'
export function DataTable<T>({ rows, columns, rowKey, empty }: { rows: T[]; columns: { key: string; label: string; render: (row: T) => ReactNode }[]; rowKey: (row: T) => string; empty: string }) {
  if (!rows.length) return <p className="rounded-xl border bg-white p-8 text-gray-500">{empty}</p>
  return <div className="max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr>{columns.map(c => <th key={c.key} className="p-4 font-medium">{c.label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map(row => <tr key={rowKey(row)}>{columns.map(c => <td key={c.key} className="max-w-xs break-words p-4">{c.render(row)}</td>)}</tr>)}</tbody></table></div>
}
