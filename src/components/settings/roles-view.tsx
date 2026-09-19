'use client'

import { useMemo, useState } from 'react'
import type { Permission, RolesData } from '@/features/roles/types'

// Map of permission code prefixes or specific codes to clean feature group titles
const DOMAIN_MAPPINGS: { prefix: string; title: string }[] = [
  { prefix: 'WORKSPACE_', title: 'Workspace' },
  { prefix: 'MEMBERS_', title: 'Members' },
  { prefix: 'ROLES_', title: 'Roles' },
  { prefix: 'TEAMS_', title: 'Teams' },
  { prefix: 'LEAD_SOURCES_', title: 'Lead Sources' },
  { prefix: 'LEADS_', title: 'Leads' },
  { prefix: 'CONTACTS_', title: 'Contacts' },
  { prefix: 'COMPANIES_', title: 'Companies' },
  { prefix: 'PIPELINES_', title: 'Pipelines' },
  { prefix: 'DEALS_', title: 'Deals' },
  { prefix: 'ACTIVITIES_', title: 'Activities' },
  { prefix: 'TASKS_', title: 'Tasks' },
  { prefix: 'PRODUCTS_', title: 'Products' },
  { prefix: 'TAGS_', title: 'Tags' },
  { prefix: 'CUSTOM_FIELDS_', title: 'Custom Fields' },
  { prefix: 'AUTOMATIONS_', title: 'Automations' },
  { prefix: 'AUDIT_', title: 'Audit Logs' },
]

function getDomainTitle(code: string): string {
  for (const mapping of DOMAIN_MAPPINGS) {
    if (code.startsWith(mapping.prefix)) {
      return mapping.title
    }
  }
  const parts = code.split('_')
  if (parts.length > 1) {
    parts.pop()
    return parts.map(p => p.charAt(0) + p.slice(1).toLowerCase()).join(' ')
  }
  return 'Other'
}

export function RolesView({ data }: { data: RolesData }) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    data.roles.length > 0 ? data.roles[0].id : ''
  )

  const selectedRole = useMemo(() => {
    return data.roles.find(r => r.id === selectedRoleId) ?? data.roles[0] ?? null
  }, [data.roles, selectedRoleId])

  const assignedPermissions = useMemo(() => {
    if (!selectedRole) return new Set<string>()
    return data.permissionsByRole[selectedRole.id] ?? new Set<string>()
  }, [data.permissionsByRole, selectedRole])

  // Group all permissions by domain feature
  const groupedPermissions = useMemo(() => {
    const groupsMap = new Map<string, Permission[]>()

    for (const perm of data.allPermissions) {
      const domain = getDomainTitle(perm.code)
      if (!groupsMap.has(domain)) {
        groupsMap.set(domain, [])
      }
      groupsMap.get(domain)!.push(perm)
    }

    return Array.from(groupsMap.entries()).map(([domain, permissions]) => ({
      domain,
      permissions,
    }))
  }, [data.allPermissions])

  if (data.roles.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500 shadow-sm">
        No roles found in this workspace.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column: Roles list */}
      <div className="lg:col-span-5 xl:col-span-4">
        <section
          aria-label="Workspace Roles"
          className="rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Roles ({data.roles.length})
          </div>
          <ul className="divide-y divide-gray-100">
            {data.roles.map(role => {
              const isSelected = selectedRole?.id === role.id
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`flex w-full items-start justify-between p-4 text-left transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/70 border-l-4 border-indigo-600 pl-3 text-indigo-950'
                        : 'hover:bg-gray-50 text-gray-900'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm leading-tight">
                          {role.name}
                        </span>
                        {role.is_system ? (
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                            System
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                            Custom
                          </span>
                        )}
                      </div>
                      {role.description && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                          {role.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        isSelected
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {role.permissionCount} perms
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {/* Right Column: Permissions breakdown */}
      <div className="lg:col-span-7 xl:col-span-8">
        <section
          aria-label="Role Permissions"
          className="rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          {selectedRole ? (
            <>
              <div className="flex flex-col border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">
                      {selectedRole.name}
                    </h2>
                    {selectedRole.is_system ? (
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        System Role
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        Custom Role
                      </span>
                    )}
                  </div>
                  {selectedRole.description && (
                    <p className="mt-1 text-sm text-gray-600">
                      {selectedRole.description}
                    </p>
                  )}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {assignedPermissions.size} of {data.allPermissions.length} granted
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-6">
                {groupedPermissions.map(group => {
                  return (
                    <div key={group.domain} className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-1">
                        {group.domain}
                      </h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {group.permissions.map(perm => {
                          const isAssigned = assignedPermissions.has(perm.code)
                          return (
                            <div
                              key={perm.id}
                              className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs transition-colors ${
                                isAssigned
                                  ? 'border-indigo-200 bg-indigo-50/40 text-gray-900'
                                  : 'border-gray-100 bg-gray-50/50 text-gray-400 opacity-60'
                              }`}
                            >
                              <div className="mt-0.5 shrink-0">
                                {isAssigned ? (
                                  <svg
                                    className="h-4 w-4 text-indigo-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="h-4 w-4 text-gray-300"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span
                                  className={`font-mono font-semibold block leading-tight ${
                                    isAssigned ? 'text-indigo-950' : 'text-gray-500'
                                  }`}
                                >
                                  {perm.code}
                                </span>
                                {perm.description && (
                                  <span className="mt-0.5 block text-gray-500 leading-tight">
                                    {perm.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-gray-500">
              Select a role from the list to view its permissions.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
