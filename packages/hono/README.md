# @anievo-id/rbac-evolution-hono

[Hono](https://hono.dev) middleware for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution), for Node, Bun,
Deno, Cloudflare Workers and other edge runtimes.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-hono hono
```

## Usage

```ts
import { Hono } from 'hono'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { type RbacEnv, rbacMiddleware, requirePermission, requireRole } from '@anievo-id/rbac-evolution-hono'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const app = new Hono<RbacEnv>()

app.use(yourAuthMiddleware) // authentication runs first
app.use(rbacMiddleware({ rbac, getSubject: (c) => getUserSubject(c) })) // yours: { type, id } or null

app.put('/articles/:id', requirePermission('edit articles|publish articles'), updateArticle) // any of
app.use('/admin/*', requireRole('admin'))
app.get('/me/permissions', async (c) => c.json(c.var.rbac ? await c.var.rbac.snapshot() : null))
```

- `c.var.rbac` is a `SubjectRbac`, or `null` for guests. Merge `RbacVariables` into your own `Variables` type if
  you have one.
- Guests get **401**, users without access get **403** `{ error, reason, message }`. The required names are only
  added with `exposeRequirements: true`. Leave it off in production.
- `createGuards<AppRbac>()` returns guards that type-check names against your `createRbac<AppRbac>()` type.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/hono

## License

MIT
