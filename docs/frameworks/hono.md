# Hono

`@anievo-id/rbac-evolution-hono` adds RBAC Evolution to [Hono](https://hono.dev) apps: one middleware that resolves
the current user's access, and route guards — `requirePermission`, `requireRole` and `requireRoleOrPermission` —
that mirror spatie/laravel-permission's `permission`, `role` and `role_or_permission` middleware.

It uses no Node-only APIs, so it runs wherever Hono runs: **Node, Bun, Deno, Cloudflare Workers, Vercel/Netlify
edge functions** and other Web-standard runtimes. Guards behave exactly like the [Express](/frameworks/express)
ones and return the same response bodies.

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-hono
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-hono
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-hono
```

:::

`hono` (4 or newer) is a peer dependency.

::: tip Storage on the edge
On Workers and other edge runtimes, pick an adapter whose database driver works there (for example Drizzle or
Prisma with an HTTP/edge driver). The `MemoryAdapter` is fine for tests and demos.
:::

## Setup

Authentication is up to you (`hono/jwt`, a session middleware, …). Register it first, then add `rbacMiddleware` and
tell it how to find the subject on the request.

```ts
import { Hono } from 'hono'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { type RbacVariables, rbacMiddleware, requirePermission } from '@anievo-id/rbac-evolution-hono'

type User = { id: string }
type AppEnv = { Variables: RbacVariables & { user: User | undefined } }

const rbac = createRbac({ adapter: new MemoryAdapter() })
const app = new Hono<AppEnv>()

app.use(yourAuthMiddleware) // sets c.var.user

app.use(
  rbacMiddleware<AppEnv>({
    rbac,
    // Return null or undefined for guests.
    getSubject: (c) => (c.var.user ? { type: 'user', id: c.var.user.id } : null),
  }),
)

app.get('/articles', requirePermission('articles.view'), (c) => c.json([]))

export default app
```

If you do not need your own variables, `new Hono<RbacEnv>()` is enough.

### `rbacMiddleware` options

| Option       | Type                                                | Description                                                |
| ------------ | --------------------------------------------------- | ---------------------------------------------------------- |
| `rbac`       | `Rbac`                                              | Your `createRbac(...)` instance. **Required.**             |
| `getSubject` | `(c) => Subject \| null \| undefined \| Promise<…>` | Resolves the current subject. **Required.**                |
| `guard`      | `string`                                            | Guard name. Defaults to the engine's `defaultGuard`.       |
| `team`       | `(c) => TeamId \| undefined \| Promise<…>`          | Current team. Only for engines created with `teams: true`. |

Pass your app's env as the type argument (`rbacMiddleware<AppEnv>(...)`) so `c` is typed inside `getSubject` and
`team`.

## `c.var.rbac`

After the middleware runs, `c.var.rbac` (or `c.get('rbac')`) is:

- a `SubjectRbac` for the current subject (the same object `rbac.for(subject, { guard, team })` returns), or
- `null` for guests.

It is typed through the `RbacVariables` / `RbacEnv` types. Use it for checks inside handlers and to send a snapshot
to the browser:

```ts
// Feed the React / Vue packages
app.get('/api/me/permissions', async (c) => c.json(c.var.rbac ? await c.var.rbac.snapshot() : null))

app.post('/articles/:id/publish', async (c) => {
  if (!(await c.var.rbac?.can('articles.publish'))) {
    return c.json({ error: 'FORBIDDEN' }, 403)
  }
  // ...publish
  return c.json({ ok: true })
})
```

## Route guards

Guards are regular Hono middleware, so they work per route or for a whole path:

```ts
app.get('/admin/stats', requireRole('admin'), handler)
app.use('/admin/*', requireRole('admin'))
```

### `requirePermission`

```ts
app.put('/articles/:id', requirePermission('articles.edit'), handler)

// any of them — pipe syntax, like spatie's permission:a|b
app.put('/articles/:id', requirePermission('articles.edit|articles.delete'), handler)

// all of them — one argument per requirement
app.put('/articles/:id', requirePermission('articles.edit', 'articles.publish'), handler)

// any of them — with { any: true }
app.put('/articles/:id', requirePermission('articles.edit', 'articles.publish', { any: true }), handler)
```

Permission checks use `can()`, so the engine's `before` hook and `superAdminRoles` apply. Unknown permissions
simply fail the check; they never throw.

### `canAny` / `canAll`

Named forms of the two common cases, like spatie v8.5's route macros. `canAny` passes with **any** of the
permissions. `canAll` needs **every** argument; a pipe inside one argument still means "any of these".

```ts
app.put('/articles/:id', canAny('articles.edit', 'articles.publish'), handler)
app.put('/articles/:id', canAll('articles.edit', 'articles.publish|articles.delete'), handler)
```

`canAny(...)` is `requirePermission(..., { any: true })`, and `canAll(...)` is `requirePermission(...)`.

### `requireRole`

```ts
app.get('/admin', requireRole('admin'), handler)
app.get('/staff', requireRole('admin|editor'), handler) // any of
app.get('/staff', requireRole('admin', 'editor'), handler) // any of
app.get('/review', requireRole('writer', 'editor', { all: true }), handler) // all of
```

### `requireRoleOrPermission`

Passes when the user has **any** of the names, either as a role or as a permission:

```ts
app.get('/dashboard', requireRoleOrPermission('admin|dashboard.view'), handler)
```

### Combining names

| Guard                     | `'a\|b'` | `'a', 'b'` (separate args) | Option                              |
| ------------------------- | -------- | -------------------------- | ----------------------------------- |
| `requirePermission`       | any      | **all**                    | `{ any: true }` → any of everything |
| `requireRole`             | any      | any                        | `{ all: true }` → all of everything |
| `requireRoleOrPermission` | any      | any                        | —                                   |

Arrays are accepted wherever a name is; each array item counts like a separate argument, so
`requirePermission(['a', 'b'])` requires both. Guards created with no names throw a `TypeError` at startup.

## Responses

| Situation                         | Default response                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Guest (`c.var.rbac === null`)     | `401` `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }`                                |
| Missing role/permission           | `403` `{ "error": "FORBIDDEN", "reason": "permission" \| "role" \| "role_or_permission", "message": "…" }` |
| `rbacMiddleware` not registered   | throws `RbacMiddlewareMissingError` (`code: 'RBAC_MIDDLEWARE_MISSING'`), handled by `app.onError`          |

The 403 body describes the kind of check but **not** the names that were required. To include them (for example
during development), pass `exposeRequirements: true`; the body then gets a `required` field with the groups of
names.

::: warning
Exposing the required permissions tells callers exactly what to look for. Keep `exposeRequirements` off in
production. See [Security](/best-practices/security).
:::

## Custom handlers

Every guard accepts `onUnauthenticated` and `onForbidden` in its options object. Both receive `(c, context)`, where
`context` is `{ kind, requirements }`, and return the `Response` to send — or throw, for example an
`HTTPException` that your `app.onError` turns into a page.

```ts
requirePermission('articles.edit', {
  onUnauthenticated: (c) => c.redirect('/login'),
  onForbidden: (c, { kind }) => c.html(`<h1>Forbidden (${kind})</h1>`, 403),
})
```

### `createGuards`

To change the defaults for every guard, build your own set with `createGuards()`:

```ts
// src/rbac-guards.ts
import { HTTPException } from 'hono/http-exception'
import { createGuards } from '@anievo-id/rbac-evolution-hono'

export const { requirePermission, requireRole, requireRoleOrPermission } = createGuards({
  onUnauthenticated: (c) => c.redirect(`/login?next=${encodeURIComponent(c.req.path)}`),
  onForbidden: () => {
    throw new HTTPException(403, { message: 'Forbidden' })
  },
})
```

Options passed to an individual guard still override the shared defaults. `createGuards()` accepts
`onUnauthenticated`, `onForbidden` and `exposeRequirements`.

## Typed names

If you pass a type to `createRbac<AppRbac>()`, pass the same type to `createGuards()`. Then a typo in a guard is a
compile error. Every name is checked, including each part of a `'a|b'` list and each array item.

```ts
import { createGuards } from '@anievo-id/rbac-evolution-hono'
import type { AppRbac } from './rbac' // the type you pass to createRbac<AppRbac>()

export const { requirePermission, requireRole } = createGuards<AppRbac>()

app.put('/articles/:id', requirePermission('edit articles|publish articles'), updateArticle)
app.delete('/articles/:id', requirePermission('delete artcles'), deleteArticle) // type error
```

`createGuards<typeof rbac>()` works too. `createGuards()` also takes the shared options shown above.

A guard without names, or with options before a name, is a type error too. The guards exported by the package
still accept any string. See [Typed names](/basic-usage/typed-names).

## Teams

When the engine is created with `teams: true`, resolve the current team per request:

```ts
const rbac = createRbac({ adapter, teams: true })

app.use(
  rbacMiddleware<AppEnv>({
    rbac,
    getSubject: (c) => (c.var.user ? { type: 'user', id: c.var.user.id } : null),
    team: (c) => c.req.header('x-team-id'),
  }),
)
```

::: warning
The team id usually comes from user input (a header, a URL segment, the session). Make sure the user actually
belongs to that team — RBAC Evolution only checks roles and permissions **within** the team you give it. See
[Teams](/basic-usage/teams).
:::

## Guards for an API

`guard` selects which guard's roles and permissions are loaded. Mount a sub-app with its own middleware:

```ts
const api = new Hono<RbacEnv>()

api.use(
  rbacMiddleware({
    rbac,
    guard: 'api',
    getSubject: (c) => {
      const clientId = c.req.header('x-client-id')
      return clientId ? { type: 'client', id: clientId } : null
    },
  }),
)

api.get('/reports', requirePermission('reports.view'), handler)

app.route('/api', api)
```

### Another guard per route

Every guard also takes a `guard` option: the check runs in that guard (`c.var.rbac.withScope({ guard })`) instead of
the middleware's, like spatie's `role:admin,api` / `permission:edit articles,api`. `c.var.rbac` itself is unchanged,
and a guest still gets `401`. `guard` is per route only: it is not a `createGuards()` default.

```ts
app.get('/api/admin', requireRole('admin', { guard: 'api' }), handler) // role:admin,api
app.get('/api/articles', requirePermission('articles.edit', { guard: 'api' }), handler) // permission:articles.edit,api
app.get('/api/reports', canAny('reports.view', 'reports.export', { guard: 'api' }), handler)
```

See [Multiple guards](/basic-usage/multiple-guards).
