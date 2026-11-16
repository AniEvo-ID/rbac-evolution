// Stub: a copy of the `src/dashboard.ts` block of docs/use-cases/public-api.md.
import { Hono } from 'hono'
import { isPermissionName } from '@anievo-id/rbac-evolution'
import { rbacMiddleware, type RbacVariables } from '@anievo-id/rbac-evolution-hono'
import { db } from './db'
import { type ApiRbac, rbac, requirePermission, type Scope } from './rbac'

type DashboardEnv = { Variables: RbacVariables<ApiRbac> & { user: { id: number; accountId: number } | undefined } }

/** One of `SCOPES`: the `api` list of `names`. */
const isScope = (name: unknown): name is Scope => isPermissionName(rbac, name, { guard: 'api' })
const isPreset = (name: unknown): name is 'read-only' | 'full-access' => name === 'read-only' || name === 'full-access'
/** A key's access, in the `api` guard: it takes the `api` names only. */
const keyAccess = (keyId: string) => rbac.for({ type: 'api_key', id: keyId }, { guard: 'api' })

export const dashboard = new Hono<DashboardEnv>()

// dashboard.use(yourSessionMiddleware) sets c.var.user
dashboard.use(
  rbacMiddleware<DashboardEnv, ApiRbac>({
    rbac,
    getSubject: (c) => (c.var.user ? { type: 'user', id: c.var.user.id } : null), // web guard
  }),
)

// POST /dashboard/keys  { "name": "Warehouse", "preset": "read-only" }
//                       { "name": "CRM sync", "scopes": ["customers.read", "customers.write"] }
dashboard.post('/keys', requirePermission('api-keys.manage'), async (c) => {
  const body = await c.req.json<{ name: string; preset?: string; scopes?: unknown[] }>()
  const preset = isPreset(body.preset) ? body.preset : null
  const scopes = body.scopes ?? []
  if (body.preset !== undefined && !preset) return c.json({ error: 'Unknown preset' }, 422)
  if (!preset && (scopes.length === 0 || !scopes.every(isScope))) return c.json({ error: 'Unknown scope' }, 422)

  const { key, secret } = await db.apiKeys.create({ name: body.name, accountId: c.var.user!.accountId })
  if (preset) await keyAccess(key.id).assignRole(preset)
  else await keyAccess(key.id).givePermissionTo(scopes.filter(isScope))

  return c.json({ id: key.id, secret }, 201) // the secret is shown once
})

// PUT /dashboard/keys/:id/scopes  { "scopes": ["orders.read"] }
dashboard.put('/keys/:id/scopes', requirePermission('api-keys.manage'), async (c) => {
  const key = await db.apiKeys.find(c.req.param('id'))
  if (!key || key.accountId !== c.var.user!.accountId) return c.json({ error: 'Not found' }, 404)

  const { scopes } = await c.req.json<{ scopes: unknown[] }>()
  if (!scopes.every(isScope)) return c.json({ error: 'Unknown scope' }, 422)

  await keyAccess(key.id).syncRoles([]) // a preset key becomes a custom key
  await keyAccess(key.id).syncPermissions(scopes)
  return c.json({ scopes })
})

dashboard.get('/keys/:id', requirePermission('api-keys.view'), async (c) => {
  const key = await db.apiKeys.find(c.req.param('id'))
  if (!key || key.accountId !== c.var.user!.accountId) return c.json({ error: 'Not found' }, 404)
  return c.json({ ...key, scopes: await keyAccess(key.id).getPermissionNames() })
})
