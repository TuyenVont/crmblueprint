import React from 'react'
import { getAppContext } from '@/server/app-context'
import { filterNavigation } from '@/components/app-shell/navigation'
import { AppShell } from '@/components/app-shell/app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await getAppContext()
  const navigation = filterNavigation(context.permissions)

  return (
    <AppShell
      navigation={navigation}
      workspaceName={context.workspaceName}
      userDisplayName={context.userDisplayName}
      userEmail={context.userEmail}
    >
      {children}
    </AppShell>
  )
}
