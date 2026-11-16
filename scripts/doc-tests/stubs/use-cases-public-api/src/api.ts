// Stub: a copy of the `src/api.ts` block of docs/use-cases/public-api.md.
import { Hono } from 'hono'
import type { Rbac } from '@anievo-id/rbac-evolution'
import { type RbacEnv, rbacMiddleware } from '@anievo-id/rbac-evolution-hono'
import { requireScope, type ApiRbac } from './rbac'

/** Finds an active (not revoked) key by its secret. */
export type FindKey = (secret: string) => Promise<{ id: string } | null>

export function createApi(rbac: Rbac<ApiRbac>, findKey: FindKey) {
  const api = new Hono<RbacEnv<ApiRbac, 'api'>>() // c.var.rbac has the names of the `api` guard

  api.use(
    rbacMiddleware({
      rbac,
      guard: 'api',
      getSubject: async (c) => {
        const header = c.req.header('authorization') ?? ''
        const secret = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
        const key = secret ? await findKey(secret) : null
        return key ? { type: 'api_key', id: key.id } : null // null: 401
      },
    }),
  )

  api.get('/orders', requireScope('orders.read'), (c) => c.json({ data: [] }))
  api.post('/orders', requireScope('orders.write'), (c) => c.json({ id: 'ord_1' }, 201))
  api.get('/customers', requireScope('customers.read'), (c) => c.json({ data: [] }))
  api.put('/customers/:id', requireScope('customers.write'), (c) => c.json({ id: c.req.param('id') }))
  api.put('/webhooks', requireScope('webhooks.manage'), (c) => c.json({ ok: true }))

  // Lets a client check which scopes its key has.
  api.get('/me', async (c) => c.json({ scopes: c.var.rbac ? await c.var.rbac.getPermissionNames() : [] }))

  return api
}
