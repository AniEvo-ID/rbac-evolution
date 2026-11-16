# @anievo-id/rbac-evolution-express

Express 4 and 5 middleware for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): the counterpart of
spatie/laravel-permission's `role`, `permission` and `role_or_permission` middleware.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-express express
```

## Usage

```ts
import express from 'express'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { rbacMiddleware, requirePermission, requireRole } from '@anievo-id/rbac-evolution-express'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const app = express()

app.use(yourAuth) // authentication runs first
app.use(rbacMiddleware({ rbac, getSubject: (req) => (req.user ? { type: 'user', id: req.user.id } : null) }))

app.put('/articles/:id', requirePermission('edit articles|publish articles'), updateArticle) // any of
app.get('/admin', requireRole('admin'), adminPage)
app.get('/me/permissions', async (req, res) => res.json(req.rbac ? await req.rbac.snapshot() : null))
```

- Guests get **401**, users without access get **403** `{ error, reason, message }`. The required names are only
  added with `exposeRequirements: true`. Leave it off in production.
- `createGuards<AppRbac>()` returns guards that type-check names against your `createRbac<AppRbac>()` type, and
  takes shared `onUnauthenticated` / `onForbidden` handlers.
- Every middleware forwards async errors to `next(err)`, also on Express 4. For your own handlers there is
  `asyncHandler(fn)`.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/express

## License

MIT
