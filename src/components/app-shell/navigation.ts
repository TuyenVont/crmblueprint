export interface NavItem {
  title: string
  href: string
  permissionCode?: string
  icon: 'dashboard' | 'leads' | 'contacts' | 'companies' | 'deals' | 'tasks' | 'products' | 'members' | 'roles'
}

export interface NavigationConfig {
  mainItems: NavItem[]
  settingsItems: NavItem[]
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', href: '/app/dashboard', icon: 'dashboard' },
  { title: 'Leads', href: '/app/leads', permissionCode: 'LEADS_VIEW', icon: 'leads' },
  { title: 'Contacts', href: '/app/contacts', permissionCode: 'CONTACTS_VIEW', icon: 'contacts' },
  { title: 'Companies', href: '/app/companies', permissionCode: 'COMPANIES_VIEW', icon: 'companies' },
  { title: 'Deals', href: '/app/deals', permissionCode: 'DEALS_VIEW', icon: 'deals' },
  { title: 'Tasks', href: '/app/tasks', permissionCode: 'TASKS_VIEW', icon: 'tasks' },
  { title: 'Products', href: '/app/products', permissionCode: 'PRODUCTS_VIEW', icon: 'products' },
]

export const SETTINGS_NAV_ITEMS: NavItem[] = [
  { title: 'Members', href: '/app/settings/members', permissionCode: 'MEMBERS_VIEW', icon: 'members' },
  { title: 'Roles', href: '/app/settings/roles', permissionCode: 'ROLES_VIEW', icon: 'roles' },
]

export function filterNavigation(permissions: Set<string>): NavigationConfig {
  const mainItems = MAIN_NAV_ITEMS.filter(
    item => !item.permissionCode || permissions.has(item.permissionCode)
  )
  const settingsItems = SETTINGS_NAV_ITEMS.filter(
    item => !item.permissionCode || permissions.has(item.permissionCode)
  )
  return { mainItems, settingsItems }
}
