import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzleSqliteAdapter } from '@anievo-id/rbac-evolution-drizzle/sqlite'
import { db } from './db'

export const PERMISSIONS = [
  'view articles',
  'create articles',
  'edit articles',
  'publish articles',
  'delete articles',
  'manage users',
] as const

export type PermissionName = (typeof PERMISSIONS)[number]

export const ROLES: Record<'admin' | 'editor' | 'viewer', readonly PermissionName[]> = {
  admin: PERMISSIONS,
  editor: ['view articles', 'create articles', 'edit articles', 'publish articles'],
  viewer: ['view articles'],
}

export type RoleName = keyof typeof ROLES
export const ROLE_NAMES = Object.keys(ROLES) as RoleName[]

export const rbac = createRbac<{ permissions: PermissionName; roles: RoleName }>({
  adapter: drizzleSqliteAdapter(db),
})
