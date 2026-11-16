# Express

`@anievo-id/rbac-evolution-express` adds RBAC Evolution to Express apps: one middleware that resolves the current
user's access, and route guards — `requirePermission`, `requireRole` and `requireRoleOrPermission` — that mirror
spatie/laravel-permission's `permission`, `role` and `role_or_permission` middleware.

It works with **Express 4 and Express 5**.

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-express
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-express
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-express
```

:::

`express` (4 or newer) is a peer dependency.

## Setup

Authentication is up to you (Passport, express-session, a JWT middleware, …). Register it first, then add
`rbacMiddleware` and tell it how to find the subject on the request.

```ts
import express from 'express'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { rbacMiddleware, requirePermission } from '@anievo-id/rbac-evolution-express'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const app = express()

app.use(express.json())
app.use(yourAuthMiddleware) // sets req.user

app.use(
  rbacMiddleware({
    rbac,
    // Return null or undefined for guests.
    getSubject: (req) => (req.user ? { type: 'user', id: req.user.id } : null),
  }),
)

app.get('/articles', requirePermission('articles.view'), (req, res) => {
  res.json([])
})

app.listen(3000)
```

### `rbacMiddleware` options

| Option       | Type                                                 | Description                                                          |
| ------------ | ---------------------------------------------------- | -------------------------------------------------------------------- |
| `rbac`       | `Rbac`                                               | Your `createRbac(...)` instance. **Required.**                       |
| `getSubject` | `(req) => Subject \| null \| undefined \| Promise<…>` | Resolves the current subject. **Required.**                          |
| `guard`      | `string`                                             | Guard name. Defaults to the engine's `defaultGuard`.                 |
| `team`       | `(req) => TeamId \| undefined \| Promise<…>`         | Current team. Only for engines created with `teams: true`.           |

## `req.rbac`

After the middleware runs, `req.rbac` is:

- a `SubjectRbac` for the current subject (the same object `rbac.for(subject, { guard, team })` returns), or
- `null` for guests.

It is typed through `Express.Request` augmentation, so no casts are needed. Use it for checks inside handlers and
to send a snapshot to the browser:

```ts
// Feed the React / Vue packages
app.get('/api/me/permissions', async (req, res) => {
  res.json(req.rbac ? await req.rbac.snapshot() : null)
})

app.post('/articles/:id/publish', async (req, res) => {
  if (!(await req.rbac?.can('articles.publish'))) {
    res.sendStatus(403)
    return
  }
  // ...publish
  res.json({ ok: true })
})
```

## Route guards

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

| Guard                       | `'a\|b'` | `'a', 'b'` (separate args) | Option            |
| --------------------------- | -------- | -------------------------- | ----------------- |
| `requirePermission`         | any      | **all**                    | `{ any: true }` → any of everything |
| `requireRole`               | any      | any                        | `{ all: true }` → all of everything |
| `requireRoleOrPermission`   | any      | any                        | —                 |

Arrays are accepted wherever a name is; each array item counts like a separate argument, so
`requirePermission(['a', 'b'])` requires both. Guards created with no names throw a `TypeError` at startup.

You can mix groups: `requirePermission('articles.edit|articles.own', 'articles.publish')` means
"(`articles.edit` **or** `articles.own`) **and** `articles.publish`".

## Responses

| Situation                              | Default response                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Guest (`req.rbac === null`)            | `401` `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }`                            |
| Missing role/permission                | `403` `{ "error": "FORBIDDEN", "reason": "permission" \| "role" \| "role_or_permission", "message": "…" }` |
| `rbacMiddleware` not registered        | `next(err)` with a `RbacMiddlewareMissingError` (`code: 'RBAC_MIDDLEWARE_MISSING'`)                    |

The 403 body describes the kind of check but **not** the names that were required. To include them (for example
during development), pass `exposeRequirements: true`; the body then gets a `required` field with the groups of
names:

```ts
requirePermission('articles.edit', { exposeRequirements: process.env.NODE_ENV !== 'production' })
```

::: warning
Exposing the required permissions tells callers exactly what to look for. Keep `exposeRequirements` off in
production. See [Security](/best-practices/security).
:::

## Custom handlers

Every guard accepts `onUnauthenticated` and `onForbidden` in its options object. Both receive
`(req, res, next, context)`, where `context` is `{ kind, requirements }` (`requirements` is a list of groups: every
group must pass, a group passes when any name in it matches).

```ts
requirePermission('articles.edit', {
  onUnauthenticated: (req, res) => res.redirect('/login'),
  onForbidden: (req, res, next, { kind }) => res.status(403).render('403', { kind }),
})
```

### `createGuards`

To change the defaults for every guard, build your own set with `createGuards()` and import guards from your module
instead of the package:

```ts
// src/rbac-guards.ts
import { createGuards } from '@anievo-id/rbac-evolution-express'

export const { requirePermission, requireRole, requireRoleOrPermission } = createGuards({
  onUnauthenticated: (req, res) => res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`),
  onForbidden: (req, res) => res.status(403).render('403'),
})
```

Options passed to an individual guard still override the shared defaults. `createGuards()` accepts
`onUnauthenticated`, `onForbidden` and `exposeRequirements`.

You can also forward to your error handler instead of responding directly:

```ts
createGuards({
  onForbidden: (req, res, next) => next(Object.assign(new Error('Forbidden'), { status: 403 })),
})
```

## Typed names

If you pass a type to `createRbac<AppRbac>()`, pass the same type to `createGuards()`. Then a typo in a guard is a
compile error. Every name is checked, including each part of a `'a|b'` list and each array item.

```ts
import { createGuards } from '@anievo-id/rbac-evolution-express'
import type { AppRbac } from './rbac' // the type you pass to createRbac<AppRbac>()

export const { requirePermission, requireRole } = createGuards<AppRbac>()

app.put('/articles/:id', requirePermission('edit articles|publish articles'), updateArticle)
app.delete('/articles/:id', requirePermission('delete artcles'), deleteArticle) // type error
```

`createGuards<typeof rbac>()` works too. `createGuards()` also takes the shared options shown above.

A guard without names, or with options before a name, is a type error too. The guards exported by the package
still accept any string. See [Typed names](/basic-usage/typed-names).

## Teams

When the engine is created with `teams: true`, resolve the current team per request. Guards and `req.rbac` then
check access within that team.

```ts
const rbac = createRbac({ adapter, teams: true })

app.use(
  rbacMiddleware({
    rbac,
    getSubject: (req) => (req.user ? { type: 'user', id: req.user.id } : null),
    team: (req) => req.header('x-team-id') ?? undefined,
  }),
)
```

::: warning
The team id usually comes from user input (a header, a URL segment, the session). Make sure the user actually
belongs to that team — RBAC Evolution only checks roles and permissions **within** the team you give it. See
[Teams](/basic-usage/teams).
:::

## Guards for an API

`guard` selects which guard's roles and permissions are loaded. A common pattern is a separate middleware stack for
an API router:

```ts
const api = express.Router()

api.use(
  rbacMiddleware({
    rbac,
    guard: 'api',
    getSubject: (req) => (req.apiClient ? { type: 'client', id: req.apiClient.id } : null),
  }),
)

api.get('/reports', requirePermission('reports.view'), handler)

app.use('/api', api)
```

See [Multiple guards](/basic-usage/multiple-guards).

## Express 4 and 5

Express 4 ignores rejected promises returned by handlers. Every middleware and guard in this package catches its
own errors and forwards them to `next(err)`, so they behave the same on both versions.

For your own async handlers on Express 4, the package exports `asyncHandler`:

```ts
import { asyncHandler } from '@anievo-id/rbac-evolution-express'

app.post(
  '/articles/:id/publish',
  asyncHandler(async (req, res) => {
    if (!(await req.rbac?.can('articles.publish'))) {
      res.sendStatus(403)
      return
    }
    res.json({ ok: true })
  }),
)
```

`asyncHandler` expects a function that resolves to nothing — send the response, then `return` without a value.
On Express 5 it is optional, since Express 5 forwards rejected promises itself.
