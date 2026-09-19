'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NavigationConfig } from './navigation'
import { NavIcon } from './nav-icon'

interface SidebarProps {
  navigation: NavigationConfig
  workspaceName: string
  onItemClick?: () => void
}

export function Sidebar({ navigation, workspaceName, onItemClick }: SidebarProps) {
  const pathname = usePathname()
  const isSettingsActive = pathname.startsWith('/app/settings')
  const [isSettingsOpen, setIsSettingsOpen] = useState(isSettingsActive)

  const isItemActive = (href: string) => {
    if (href === '/app/dashboard') {
      return pathname === '/app/dashboard' || pathname === '/app'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200 w-64 select-none">
      {/* Workspace Brand / Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-sm">
          {workspaceName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate" title={workspaceName}>
            {workspaceName}
          </h2>
          <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700 rounded-full">
            CRM Workspace
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {/* Main Navigation Group */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            CRM
          </p>
          {navigation.mainItems.map(item => {
            const active = isItemActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onItemClick}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <NavIcon name={item.icon} className={`w-5 h-5 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </div>

        {/* Settings Navigation Group - Only shown if user has visible settings items */}
        {navigation.settingsItems.length > 0 && (
          <div className="space-y-1 pt-4 border-t border-gray-100">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <span>Settings</span>
              <NavIcon
                name={isSettingsOpen ? 'chevron-down' : 'chevron-right'}
                className="w-4 h-4 text-gray-400"
              />
            </button>

            {isSettingsOpen && (
              <div className="space-y-1 mt-1 pl-2">
                {navigation.settingsItems.map(item => {
                  const active = isItemActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onItemClick}
                      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        active
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <NavIcon name={item.icon} className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <span>{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  )
}
