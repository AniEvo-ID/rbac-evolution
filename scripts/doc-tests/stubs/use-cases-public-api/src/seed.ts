// Stub: a copy of the `src/seed.ts` block of docs/use-cases/public-api.md.
import type { PermissionName, SyncDefinition } from '@anievo-id/rbac-evolution'
import type { ApiRbac } from './rbac'

/** Every scope a key can have. Also the allow-list for custom keys. */
export const SCOPES = [
  'orders.read',
  'orders.write',
  'customers.read',
  'customers.write',
  'webhooks.manage',
] as const satisfies readonly PermissionName<ApiRbac>[]

export type Scope = (typeof SCOPES)[number]

export const apiSeed = [
  {
    guard: 'web',
    roles: { viewer: ['api-keys.view'], developer: ['api-keys.view', 'api-keys.manage'] },
  },
  {
    guard: 'api',
    permissions: [...SCOPES],
    roles: { 'read-only': ['orders.read', 'customers.read'], 'full-access': '*' },
  },
] satisfies SyncDefinition<ApiRbac>[]
