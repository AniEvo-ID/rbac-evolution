# @anievo-id/rbac-evolution-express

📖 **[Documentation](https://creation.anievo.id/rbac-evolution/frameworks/express)**

Express middleware for [rbac-evolution](https://github.com/AniEvo-ID/rbac-evolution) — the counterpart of spatie/laravel-permission's
`role`, `permission` and `role_or_permission` middleware. Works with **Express 4 and 5**
(async errors are always forwarded to `next(err)`).

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-express
```

## Setup

```ts
import express from 'express'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { rbacMiddleware, requirePermission, requireRole, requireRoleOrPermission } from '@anievo-id/rbac-evolution-express'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const app = express()

app.use(session(/* ... */), passport.session()) // your authentication runs first

app.use(
  rbacMiddleware({
    rbac,
    // return null/undefined for guests
    getSubject: (req) => (req.user ? { type: 'user', id: req.user.id } : null),
    guard: 'web', // optional, defaults to the engine's defaultGuard
    team: (req) => req.session.currentTeamId, // optional, only with createRbac({ teams: true })
  }),
)
```

`rbacMiddleware` attaches `req.rbac`: a `SubjectRbac` for the current subject, or `null` for guests
(typed through `Express.Request` augmentation).

```ts
app.get('/me/permissions', async (req, res) => {
  res.json(req.rbac ? await req.rbac.snapshot() : null) // feed it to the React/Vue packages
})

app.post('/articles/:id/publish', async (req, res) => {
  if (!(await req.rbac?.can('publish articles'))) return res.sendStatus(403)
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
```

Arrays are accepted anywhere a name is (`requirePermission(['a', 'b'])` = all of).
Unknown permissions simply fail the check (no exception).

### Responses

- No subject (`req.rbac === null`) → **401** `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }`
- Not allowed → **403** `{ "error": "FORBIDDEN", "reason": "permission" | "role" | "role_or_permission", "message": "..." }`
- `rbacMiddleware` not registered → `next(RbacMiddlewareMissingError)` (`code: 'RBAC_MIDDLEWARE_MISSING'`)

The required names are not included in the 403 body unless you pass `exposeRequirements: true`
(like spatie's `display_permission_in_exception`).

### Custom handlers

Per guard:

```ts
requirePermission('edit articles', {
  onUnauthenticated: (req, res) => res.redirect('/login'),
  onForbidden: (req, res, next, { kind, requirements }) => res.status(403).render('403'),
})
```

Or once for all guards:

```ts
import { createGuards } from '@anievo-id/rbac-evolution-express'

export const { requirePermission, requireRole, requireRoleOrPermission } = createGuards({
  onUnauthenticated: (req, res) => res.redirect('/login'),
  onForbidden: (req, res, next) => next(new HttpError(403)),
})
```

## Typed names

Pass the type you gave `createRbac<AppRbac>()` to `createGuards()`, and a typo in a guard name is a compile error:

```ts
import { createGuards } from '@anievo-id/rbac-evolution-express'
import type { AppRbac } from './rbac' // the type you pass to createRbac<AppRbac>()

export const { requirePermission, requireRole } = createGuards<AppRbac>()

app.put('/articles/:id', requirePermission('edit articles|publish articles'), updateArticle)
app.delete('/articles/:id', requirePermission('delete artcles'), deleteArticle) // type error
```

`createGuards<typeof rbac>()` works too. The guards exported by the package still accept any string.

## Express 4

Express 4 ignores rejected promises from handlers. Every middleware in this package catches its own
errors and calls `next(err)`. For your own async handlers you can use the exported `asyncHandler(fn)` helper.

## License

MIT
