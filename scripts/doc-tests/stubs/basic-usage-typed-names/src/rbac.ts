// Stub: a copy of the `src/rbac.ts` block of docs/basic-usage/typed-names.md ("Names per guard"). It replaces
// the shared `./rbac` stub on this page.
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

export type AppRbac = {
  guards: {
    web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
    api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
  }
  defaultGuard: 'web' // optional when it is 'web'; must match createRbac({ defaultGuard })
}

export const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
