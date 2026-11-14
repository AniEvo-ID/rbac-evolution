# @anievo-id/rbac-evolution-hono

📖 **[Documentation](https://app.anievo.id/rbac-evolution/frameworks/hono)**

[Hono](https://hono.dev) middleware for [rbac-evolution](../core) — the counterpart of spatie/laravel-permission's
`role`, `permission` and `role_or_permission` middleware. Runs anywhere Hono runs: **Node, Bun, Deno,
Cloudflare Workers and other edge runtimes** (no Node-only APIs).

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-hono hono
```

## Setup

```ts
import { Hono } from 'hono'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { type RbacEnv, rbacMiddleware, requirePermission, requireRole } from '@anievo-id/rbac-evolution-hono'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const app = new Hono<RbacEnv>()

app.use(yourAuthMiddleware) // your authentication runs first

app.use(
  rbacMiddleware({
    rbac,
    // return null/undefined for guests
    getSubject: (c) => {
      const userId = c.req.header('x-user-id')
      return userId ? { type: 'user', id: userId } : null
    },
    guard: 'web', // optional, defaults to the engine's defaultGuard
    team: (c) => c.req.header('x-team-id'), // optional, only with createRbac({ teams: true })
  }),
)
```

`rbacMiddleware` sets `c.var.rbac`: a `SubjectRbac` for the current subject, or `null` for guests.
Type it with `new Hono<RbacEnv>()`, or merge `RbacVariables` into your own variables:

```ts
import type { RbacVariables } from '@anievo-id/rbac-evolution-hono'

type AppEnv = { Variables: RbacVariables & { user: User | undefined } }
const app = new Hono<AppEnv>()

app.use(rbacMiddleware<AppEnv>({ rbac, getSubject: (c) => (c.var.user ? { type: 'user', id: c.var.user.id } : null) }))

app.get('/me/permissions', async (c) => c.json(c.var.rbac ? await c.var.rbac.snapshot() : null))

app.post('/articles/:id/publish', async (c) => {
  if (!(await c.var.rbac?.can('publish articles'))) return c.json({ error: 'FORBIDDEN' }, 403)
  // ...
})
```

## Guards

```ts
app.put('/articles/:id', requirePermission('edit articles'), handler)
app.put('/articles/:id', requirePermission('edit articles|delete articles'), handler) // any of (pipe, like spatie)
app.put('/articles/:id', requirePermission('edit articles', 'publish articles'), handler) // all of
app.put('/articles/:id', requirePermission('edit articles', 'publish articles', { any: true }), handler) // any of

app.get('/admin', requireRole('admin'), handler)
app.get('/staff', requireRole('admin|editor'), handler) // any of
app.get('/staff', requireRole('admin', 'editor'), handler) // any of
app.get('/both', requireRole('writer', 'editor', { all: true }), handler) // all of

app.get('/dashboard', requireRoleOrPermission('admin|view dashboard'), handler) // any role OR any permission

app.use('/admin/*', requireRole('admin')) // guard a whole sub-tree
```

Arrays are accepted anywhere a name is (`requirePermission(['a', 'b'])` = all of).
Unknown permissions simply fail the check (no exception). Permission checks go through `can()`,
so `superAdminRoles` and the engine's `before` hook apply.

### Responses

- No subject (`c.var.rbac === null`) → **401** `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }`
- Not allowed → **403** `{ "error": "FORBIDDEN", "reason": "permission" | "role" | "role_or_permission", "message": "..." }`
- `rbacMiddleware` not registered → throws `RbacMiddlewareMissingError` (`code: 'RBAC_MIDDLEWARE_MISSING'`), handled by `app.onError`

The required names are not included in the 403 body unless you pass `exposeRequirements: true`
(like spatie's `display_permission_in_exception`).

### Custom handlers

Handlers return the `Response` to send (or throw, e.g. an `HTTPException`). Per guard:

```ts
requirePermission('edit articles', {
  onUnauthenticated: (c) => c.redirect('/login'),
  onForbidden: (c, { kind, requirements }) => c.html('<h1>Forbidden</h1>', 403),
})
```

Or once for all guards:

```ts
import { HTTPException } from 'hono/http-exception'
import { createGuards } from '@anievo-id/rbac-evolution-hono'

export const { requirePermission, requireRole, requireRoleOrPermission } = createGuards({
  onUnauthenticated: (c) => c.redirect('/login'),
  onForbidden: () => {
    throw new HTTPException(403)
  },
})
```

## License

MIT
