// Stub: a copy of the `src/rbac.ts` block of docs/use-cases/public-api.md.
import { createRbac } from '@anievo-id/rbac-evolution'
import { createGuards } from '@anievo-id/rbac-evolution-hono'
import { adapter } from './db' // an adapter whose driver runs on your runtime, see Adapters

export type ApiRbac = {
  permissions:
    // api guard: the scopes of a key
    | 'orders.read'
    | 'orders.write'
    | 'customers.read'
    | 'customers.write'
    | 'webhooks.manage'
    // web guard: the dashboard
    | 'api-keys.view'
    | 'api-keys.manage'
  roles: 'read-only' | 'full-access' | 'viewer' | 'developer'
}

export const rbac = createRbac<ApiRbac>({ adapter })

/** Guards of the public API. A 403 names the missing scope. */
export const { requirePermission: requireScope } = createGuards<ApiRbac>({ exposeRequirements: true })

/** Guards of the dashboard. */
export const { requirePermission } = createGuards<ApiRbac>()
