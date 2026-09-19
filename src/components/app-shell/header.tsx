'use client'

import React from 'react'
import { LogoutButton } from '@/components/auth/logout-button'
import { NavIcon } from './nav-icon'

interface HeaderProps {
  workspaceName: string
  userDisplayName: string
  userEmail: string
  onMenuToggle: () => void
}

export function Header({ workspaceName, userDisplayName, userEmail, onMenuToggle }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-10 shadow-xs">
      {/* Mobile Left Section: Toggle & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Open navigation menu"
        >
          <NavIcon name="menu" className="w-6 h-6" />
        </button>
        <div className="md:hidden font-semibold text-gray-900 text-sm truncate max-w-[160px]">
          {workspaceName}
        </div>
      </div>

      {/* User Information & Logout Action */}
      <div className="flex items-center gap-4 ml-auto">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-gray-900 leading-none">{userDisplayName}</p>
          <p className="text-xs text-gray-500 mt-1 leading-none">{userEmail}</p>
        </div>

        <div className="h-8 w-px bg-gray-200 hidden sm:block" />

        <LogoutButton />
      </div>
    </header>
  )
}
