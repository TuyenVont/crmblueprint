'use client'

import React, { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { MobileNav } from './mobile-nav'
import { NavigationConfig } from './navigation'

interface AppShellProps {
  children: React.ReactNode
  navigation: NavigationConfig
  workspaceName: string
  userDisplayName: string
  userEmail: string
}

export function AppShell({
  children,
  navigation,
  workspaceName,
  userDisplayName,
  userEmail,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Fixed Sidebar */}
      <div className="hidden md:flex md:shrink-0 h-full">
        <Sidebar navigation={navigation} workspaceName={workspaceName} />
      </div>

      {/* Mobile Drawer */}
      <MobileNav
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        navigation={navigation}
        workspaceName={workspaceName}
      />

      {/* Main Content Body */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          workspaceName={workspaceName}
          userDisplayName={userDisplayName}
          userEmail={userEmail}
          onMenuToggle={() => setMobileOpen(true)}
        />

        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
