import { createRbac } from '@anievo-id/rbac-evolution'
import { kyselyAdapter } from '@anievo-id/rbac-evolution-kysely'
import { createRbacDecorators } from '@anievo-id/rbac-evolution-nestjs'
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

/** Typed names: a misspelt role or permission in a decorator is a compile error. */
export type AppRbac = { permissions: PermissionName; roles: RoleName }

export const rbac = createRbac<AppRbac>({ adapter: kyselyAdapter(db) })

export const { RequirePermissions, RequireRoles, RequireRoleOrPermission } = createRbacDecorators<AppRbac>()
