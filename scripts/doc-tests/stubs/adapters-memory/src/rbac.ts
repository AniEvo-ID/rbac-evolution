// `rbac.ts` of "Example: roles defined in code" (the block before).
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

const ROLES = {
  viewer: ['view articles'],
  writer: ['view articles', 'edit articles'],
  admin: ['view articles', 'edit articles', 'delete articles', 'manage users'],
} as const

export type RoleName = keyof typeof ROLES
export type PermissionName = (typeof ROLES)[RoleName][number]

export const rbac = createRbac<{ roles: RoleName; permissions: PermissionName }>({ adapter: new MemoryAdapter() })

export declare const ready: Promise<void>
