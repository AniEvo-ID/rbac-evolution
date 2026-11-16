# Public REST API with API keys

A public REST API for an order management product, built with [Hono](/frameworks/hono). Customers create API keys
in a web dashboard and give each key only the scopes it needs. Keys and people live in two
[guards](/basic-usage/multiple-guards), and a key's scopes are [direct permissions](/basic-usage/direct-permissions).

## The app

The product has a dashboard for people and a REST API for machines. A customer's developer signs in to the
dashboard, creates a key for their warehouse integration with read access to orders, and another key for their CRM
sync with write access to customers. A leaked key can then only do what its scopes allow.

| User | Signs in with | Guard |
| --- | --- | --- |
| Developer | Email and password, in the dashboard. Creates, edits and revokes keys. | `web` |
| Viewer | Email and password. Sees the list of keys, can't change them. | `web` |
| API key | `Authorization: Bearer <secret>` on every request. | `api` |

## Roles and permissions

The `api` guard holds the scopes. Most keys use a preset role; a key with custom scopes gets them as direct
permissions:

| Scope (`api` guard) | read-only | full-access | custom key |
| --- | :---: | :---: | :---: |
| `orders.read` | ✔ | ✔ | pick |
| `orders.write` | | ✔ | pick |
| `customers.read` | ✔ | ✔ | pick |
| `customers.write` | | ✔ | pick |
| `webhooks.manage` | | ✔ | pick |

The `web` guard holds what people can do in the dashboard:

| Permission (`web` guard) | viewer | developer |
| --- | :---: | :---: |
| `api-keys.view` | ✔ | ✔ |
| `api-keys.manage` | | ✔ |

Why this split:

- **Two guards.** A key and a person are different kinds of subjects, signed in in different ways. With a separate
  `api` guard, nothing a developer has in the dashboard ever counts for a key, even if a name is the same.
- **Direct permissions for custom keys.** Scopes are exactly the "one subject needs these few permissions" case.
  Making a role per key would fill the roles table with one-off roles. See
  [Roles vs permissions](/best-practices/roles-vs-permissions#direct-permissions).
- **Preset roles for common keys.** `read-only` and `full-access` cover most keys. When you add a new scope, the
  `full-access` role (`'*'`) gets it on the next seed, and every full-access key with it.

## Seed it

One engine, one set of typed names, two guards:

```ts
// src/rbac.ts
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
```

```ts
// src/seed.ts
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
```

`'*'` means every permission **of that guard**, so `full-access` gets the five scopes and never `api-keys.manage`.
Run `await rbac.sync(apiSeed)` on deploy. See [Seeding: multiple guards](/advanced/seeding#multiple-guards).

## Assign roles

The dashboard creates a key, then gives it a preset role or custom scopes in the `api` guard. The subject is
`{ type: 'api_key', id: key.id }`:

```ts
// src/dashboard.ts
import { Hono } from 'hono'
import { rbacMiddleware, type RbacVariables } from '@anievo-id/rbac-evolution-hono'
import { db } from './db'
import { rbac, requirePermission } from './rbac'
import { SCOPES, type Scope } from './seed'

type DashboardEnv = { Variables: RbacVariables & { user: { id: number; accountId: number } | undefined } }

const isScope = (name: unknown): name is Scope => SCOPES.includes(name as Scope)
const isPreset = (name: unknown): name is 'read-only' | 'full-access' => name === 'read-only' || name === 'full-access'
const keyAccess = (keyId: string) => rbac.for({ type: 'api_key', id: keyId }, { guard: 'api' })

export const dashboard = new Hono<DashboardEnv>()

// dashboard.use(yourSessionMiddleware) sets c.var.user
dashboard.use(
  rbacMiddleware<DashboardEnv>({
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
```

`SCOPES` is the allow-list. Without it, a developer could send `"scopes": ["api-keys.manage"]`. (The `api` guard
has no such permission, so `givePermissionTo()` would throw `PermissionDoesNotExist`, a 500 instead of a 422.)
[`isPermissionName()`](/basic-usage/typed-names#checking-user-input) is not enough here: it checks against every
name of the engine, `api-keys.manage` included, because typed names are per engine, not per guard.

`getPermissionNames()` returns the scopes from the preset role and the direct ones together, which is what the
dashboard shows.

## Guard the routes

The public API is its own Hono app with its own `rbacMiddleware` in the `api` guard. It takes the engine and the
key lookup as parameters, so the test below can pass in-memory ones:

```ts
// src/api.ts
import { Hono } from 'hono'
import type { Rbac } from '@anievo-id/rbac-evolution'
import { type RbacEnv, rbacMiddleware } from '@anievo-id/rbac-evolution-hono'
import { requireScope, type ApiRbac } from './rbac'

/** Finds an active (not revoked) key by its secret. */
export type FindKey = (secret: string) => Promise<{ id: string } | null>

export function createApi(rbac: Rbac<ApiRbac>, findKey: FindKey) {
  const api = new Hono<RbacEnv<ApiRbac>>() // c.var.rbac has the typed names

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
```

```ts
// src/index.ts
import { Hono } from 'hono'
import { createApi } from './api'
import { dashboard } from './dashboard'
import { db } from './db'
import { rbac } from './rbac'

const app = new Hono()
app.route('/v1', createApi(rbac, (secret) => db.apiKeys.findActiveBySecret(secret)))
app.route('/dashboard', dashboard)

export default app
```

A key without `orders.write` that calls `POST /v1/orders` gets:

```json
{
  "error": "FORBIDDEN",
  "reason": "permission",
  "message": "User does not have the right permissions.",
  "required": [["orders.write"]]
}
```

::: tip `exposeRequirements` in a public API
In a private app, hide the required names (the default), so a caller can't learn what to look for. In a public
API the scopes are in your docs anyway, and "missing scope `orders.write`" saves your customers a support ticket.
That's why only `requireScope` sets `exposeRequirements: true`. See [Security](/best-practices/security).
:::

## Edge cases

### Revoking a key

Mark the key as revoked, so `findActiveBySecret()` stops finding it. Then remove its roles and scopes in one call,
so no stale rows are left behind:

```ts
// in src/dashboard.ts
dashboard.delete('/keys/:id', requirePermission('api-keys.manage'), async (c) => {
  const key = await db.apiKeys.find(c.req.param('id'))
  if (!key || key.accountId !== c.var.user!.accountId) return c.json({ error: 'Not found' }, 404)

  await db.apiKeys.update(key.id, { revokedAt: new Date() })
  await rbac.for({ type: 'api_key', id: key.id }, { guard: 'api' }).revokeAll()
  return c.body(null, 204)
})
```

The revoked key is rejected at once, because the lookup fails before any permission check.

### Rotating a secret

Keep the key's id and replace only the stored hash of its secret. The scopes belong to the subject
`{ type: 'api_key', id }`, so they stay with the key.

### People and keys don't mix

A developer's session can't call `/v1`: the API's `getSubject` only accepts API keys. And a key can't use the
dashboard: its subject type is `api_key` and its roles are in the `api` guard. Even if a developer had
`orders.read` in `web`, `rbac.for(developer, { guard: 'api' }).can('orders.read')` would be `false`.

### Typed names are per engine

`ApiRbac` lists the names of both guards together, so the compiler accepts `requireScope('api-keys.manage')` on an
API route. It would fail at runtime (no key has it), not at compile time. Keep the two lists in separate constants,
as `SCOPES` does, to make such mistakes easy to spot.

## Test it

Hono apps answer `app.request()` without a server. Pass an in-memory engine and a fake key lookup to
`createApi()`:

```ts
// test/api.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { createApi } from '../src/api'
import type { ApiRbac } from '../src/rbac'
import { apiSeed } from '../src/seed'

describe('public API scopes', () => {
  let api: ReturnType<typeof createApi>
  const get = (path: string, secret: string) => api.request(path, { headers: { authorization: `Bearer ${secret}` } })

  beforeEach(async () => {
    const rbac = createRbac<ApiRbac>({ adapter: new MemoryAdapter(), cache: false })
    await rbac.sync(apiSeed)
    await rbac.for({ type: 'api_key', id: 'k_read' }, { guard: 'api' }).assignRole('read-only')
    await rbac.for({ type: 'api_key', id: 'k_crm' }, { guard: 'api' }).givePermissionTo('customers.read')

    const keys: Record<string, string> = { 'secret-read': 'k_read', 'secret-crm': 'k_crm' }
    api = createApi(rbac, async (secret) => (keys[secret] ? { id: keys[secret] } : null))
  })

  it('accepts a key with the scope', async () => {
    expect((await get('/orders', 'secret-read')).status).toBe(200)
    expect((await get('/customers', 'secret-crm')).status).toBe(200)
  })

  it('rejects a key without the scope, and names it', async () => {
    const res = await get('/orders', 'secret-crm')
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ required: [['orders.read']] })
  })

  it('rejects unknown keys with 401', async () => {
    expect((await get('/orders', 'nope')).status).toBe(401)
  })
})
```

## Related

- [Multiple guards](/basic-usage/multiple-guards) and [Direct permissions](/basic-usage/direct-permissions)
- [Hono](/frameworks/hono#guards-for-an-api)
- [Seeding](/advanced/seeding#multiple-guards)
- [Security](/best-practices/security)
- [Testing](/advanced/testing)
