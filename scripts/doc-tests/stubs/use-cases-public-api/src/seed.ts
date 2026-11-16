// Stub: a copy of the `src/seed.ts` block of docs/use-cases/public-api.md.
import type { GuardSyncDefinition } from '@anievo-id/rbac-evolution'
import { type ApiRbac, SCOPES } from './rbac'

/** Each block is checked against the names of its own guard. */
export const apiSeed: GuardSyncDefinition<ApiRbac>[] = [
  {
    guard: 'web',
    roles: { viewer: ['api-keys.view'], developer: ['api-keys.view', 'api-keys.manage'] },
  },
  {
    guard: 'api',
    permissions: [...SCOPES],
    roles: { 'read-only': ['orders.read', 'customers.read'], 'full-access': '*' },
  },
]
