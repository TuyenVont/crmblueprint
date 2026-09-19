'use client'

import React from 'react'
import { Sidebar } from './sidebar'
import { NavigationConfig } from './navigation'
import { NavIcon } from './nav-icon'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
  navigation: NavigationConfig
  workspaceName: string
}

export function MobileNav({ isOpen, onClose, navigation, workspaceName }: MobileNavProps) {
  if (!isOpen) return null

  return (
    <div className="relative z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out drawer */}
      <div className="fixed inset-y-0 left-0 flex max-w-full">
        <div className="relative w-64 bg-white shadow-xl flex flex-col h-full">
          {/* Close button */}
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label="Close menu"
            >
              <NavIcon name="close" className="w-5 h-5" />
            </button>
          </div>

          <Sidebar navigation={navigation} workspaceName={workspaceName} onItemClick={onClose} />
        </div>
      </div>
    </div>
  )
}
