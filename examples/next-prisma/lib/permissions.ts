// Every role and permission the app knows about. Used for typed names (createRbac<AppRbac>)
// and by the seed script.

export const PERMISSIONS = [
  'view articles',
  'create articles',
  'edit articles',
  'publish articles',
  'delete articles',
  'manage users',
] as const

export const ROLES = {
  admin: [...PERMISSIONS],
  editor: ['view articles', 'create articles', 'edit articles', 'publish articles'],
  viewer: ['view articles'],
} as const satisfies Record<string, readonly (typeof PERMISSIONS)[number][]>

export type AppRbac = {
  permissions: (typeof PERMISSIONS)[number]
  roles: keyof typeof ROLES
}

export const ROLE_NAMES = Object.keys(ROLES) as (keyof typeof ROLES)[]
