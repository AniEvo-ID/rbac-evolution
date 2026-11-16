// Stub: a copy of the `src/rbac.ts` block of docs/use-cases/public-api.md.
import { createRbac } from '@anievo-id/rbac-evolution'
import { createGuards } from '@anievo-id/rbac-evolution-hono'
import { adapter } from './db' // an adapter whose driver runs on your runtime, see Adapters

/** Every scope a key can have. Also the allow-list for custom keys. */
export const SCOPES = ['orders.read', 'orders.write', 'customers.read', 'customers.write', 'webhooks.manage'] as const

export type Scope = (typeof SCOPES)[number]

export type ApiRbac = {
  guards: {
    web: { permissions: 'api-keys.view' | 'api-keys.manage'; roles: 'viewer' | 'developer' } // the dashboard
    api: { permissions: Scope; roles: 'read-only' | 'full-access' } // the scopes of a key
  }
  defaultGuard: 'web'
}

// `names` gives `isPermissionName(rbac, input, { guard: 'api' })` the list to check user input against.
export const rbac = createRbac<ApiRbac>({ adapter, names: { guards: { api: { permissions: SCOPES } } } })

/** Guards of the public API, whose requests are in the `api` guard. A 403 names the missing scope. */
export const { requirePermission: requireScope } = createGuards<ApiRbac, 'api'>({ exposeRequirements: true })

/** Guards of the dashboard (the default guard, `web`). */
export const { requirePermission } = createGuards<ApiRbac>()
