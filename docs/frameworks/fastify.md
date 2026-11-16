# Fastify

`@anievo-id/rbac-evolution-fastify` adds RBAC Evolution to [Fastify](https://fastify.dev) apps: a plugin that
resolves the current user's access into `request.rbac`, and `preHandler` guards — `requirePermission`,
`requireRole` and `requireRoleOrPermission` — that mirror spatie/laravel-permission's `permission`, `role` and
`role_or_permission` middleware. Guards behave exactly like the [Express](/frameworks/express) ones and return the
same response bodies.

It requires **Fastify 5**.

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-fastify
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-fastify
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-fastify
```

:::

`fastify` (5 or newer) is a peer dependency.

## Setup

Authentication is up to you (`@fastify/jwt`, `@fastify/session`, …). Register it first, then register `rbacPlugin`
and tell it how to find the subject on the request.

```ts
import Fastify from 'fastify'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { rbacPlugin, requirePermission } from '@anievo-id/rbac-evolution-fastify'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const app = Fastify()

await app.register(yourAuthPlugin) // sets request.user

await app.register(rbacPlugin, {
  rbac,
  // Return null or undefined for guests.
  getSubject: (request) => (request.user ? { type: 'user', id: request.user.id } : null),
})

app.get('/articles', { preHandler: requirePermission('articles.view') }, async () => [])

await app.listen({ port: 3000 })
```

The plugin is wrapped with `fastify-plugin`, so its hook applies to the context you register it in — register it on
the root instance for the whole app, or inside an encapsulated plugin to scope it (see
[Guards for an API](#guards-for-an-api)).

### `rbacPlugin` options

| Option       | Type                                                       | Description                                                                         |
| ------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `rbac`       | `Rbac`                                                     | Your `createRbac(...)` instance. **Required.**                                      |
| `getSubject` | `(request) => Subject \| null \| undefined \| Promise<…>`  | Resolves the current subject. **Required.**                                         |
| `guard`      | `string`                                                   | Guard name. Defaults to the engine's `defaultGuard`.                                |
| `team`       | `(request) => TeamId \| undefined \| Promise<…>`           | Current team. Only for engines created with `teams: true`.                          |
| `hook`       | `'onRequest' \| 'preValidation' \| 'preHandler'`           | Hook in which the subject is resolved. Defaults to `'preHandler'`.                  |

The default `preHandler` hook runs after authentication done in `onRequest` / `preValidation` hooks (including
route-level ones such as `onRequest: [app.authenticate]`) and before the route's own `preHandler` guards. Choose an
earlier `hook` if you need `request.rbac` sooner, as long as your authentication has already run by then.

## `request.rbac`

After the hook runs, `request.rbac` is:

- a `SubjectRbac` for the current subject (the same object `rbac.for(subject, { guard, team })` returns), or
- `null` for guests.

It is typed through `FastifyRequest` module augmentation, so no casts are needed. Use it for checks inside handlers
and to send a snapshot to the browser:

```ts
// Feed the React / Vue packages
app.get('/api/me/permissions', async (request) => (request.rbac ? request.rbac.snapshot() : null))

app.post('/articles/:id/publish', async (request, reply) => {
  if (!(await request.rbac?.can('articles.publish'))) {
    return reply.code(403).send({ error: 'FORBIDDEN' })
  }
  // ...publish
  return { ok: true }
})
```

## Route guards

Guards are `preHandler` hooks. Use them in route options, as an array, or for a whole encapsulated scope:

```ts
app.get('/admin/stats', { preHandler: requireRole('admin') }, handler)

app.post('/articles', { preHandler: [requireRole('writer'), requirePermission('articles.create')] }, handler)

app.register(
  async (admin) => {
    admin.addHook('preHandler', requireRole('admin'))
    admin.get('/users', handler)
  },
  { prefix: '/admin' },
)
```

### `requirePermission`

```ts
app.put('/articles/:id', { preHandler: requirePermission('articles.edit') }, handler)

// any of them — pipe syntax, like spatie's permission:a|b
app.put('/articles/:id', { preHandler: requirePermission('articles.edit|articles.delete') }, handler)

// all of them — one argument per requirement
app.put('/articles/:id', { preHandler: requirePermission('articles.edit', 'articles.publish') }, handler)

// any of them — with { any: true }
app.put('/articles/:id', { preHandler: requirePermission('articles.edit', 'articles.publish', { any: true }) }, handler)
```

Permission checks use `can()`, so the engine's `before` hook and `superAdminRoles` apply. Unknown permissions
simply fail the check; they never throw.

### `canAny` / `canAll`

Named forms of the two common cases, like spatie v8.5's route macros. `canAny` passes with **any** of the
permissions. `canAll` needs **every** argument; a pipe inside one argument still means "any of these".

```ts
app.put('/articles/:id', { preHandler: canAny('articles.edit', 'articles.publish') }, handler)
app.put('/articles/:id', { preHandler: canAll('articles.edit', 'articles.publish|articles.delete') }, handler)
```

`canAny(...)` is `requirePermission(..., { any: true })`, and `canAll(...)` is `requirePermission(...)`.

### `requireRole`

```ts
app.get('/admin', { preHandler: requireRole('admin') }, handler)
app.get('/staff', { preHandler: requireRole('admin|editor') }, handler) // any of
app.get('/staff', { preHandler: requireRole('admin', 'editor') }, handler) // any of
app.get('/review', { preHandler: requireRole('writer', 'editor', { all: true }) }, handler) // all of
```

### `requireRoleOrPermission`

Passes when the user has **any** of the names, either as a role or as a permission:

```ts
app.get('/dashboard', { preHandler: requireRoleOrPermission('admin|dashboard.view') }, handler)
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

| Situation                              | Default response                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Guest (`request.rbac === null`)        | `401` `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }`                                |
| Missing role/permission                | `403` `{ "error": "FORBIDDEN", "reason": "permission" \| "role" \| "role_or_permission", "message": "…" }` |
| `rbacPlugin` not registered for route  | throws `RbacMiddlewareMissingError` (`code: 'RBAC_MIDDLEWARE_MISSING'`, `statusCode: 500`)                 |

The 403 body describes the kind of check but **not** the names that were required. To include them (for example
during development), pass `exposeRequirements: true`; the body then gets a `required` field with the groups of
names.

::: warning
Exposing the required permissions tells callers exactly what to look for. Keep `exposeRequirements` off in
production. See [Security](/best-practices/security).
:::

## Custom handlers

Every guard accepts `onUnauthenticated` and `onForbidden` in its options object. Both receive
`(request, reply, context)`, where `context` is `{ kind, requirements }`. A handler must either send a reply or
throw (the error goes to your error handler).

```ts
requirePermission('articles.edit', {
  onUnauthenticated: (request, reply) => reply.redirect('/login'),
  onForbidden: (request, reply, { kind }) => reply.code(403).send({ message: `Forbidden (${kind})` }),
})
```

### `createGuards`

To change the defaults for every guard, build your own set with `createGuards()`:

```ts
// src/rbac-guards.ts
import { createGuards } from '@anievo-id/rbac-evolution-fastify'

export const { requirePermission, requireRole, requireRoleOrPermission } = createGuards({
  onUnauthenticated: (request, reply) => reply.redirect(`/login?next=${encodeURIComponent(request.url)}`),
  onForbidden: () => {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  },
})
```

Options passed to an individual guard still override the shared defaults. `createGuards()` accepts
`onUnauthenticated`, `onForbidden` and `exposeRequirements`.

## Typed names

If you pass a type to `createRbac<AppRbac>()`, pass the same type to `createGuards()`. Then a typo in a guard is a
compile error. Every name is checked, including each part of a `'a|b'` list and each array item.

```ts
import { createGuards } from '@anievo-id/rbac-evolution-fastify'
import type { AppRbac } from './rbac' // the type you pass to createRbac<AppRbac>()

export const { requirePermission, requireRole } = createGuards<AppRbac>()

app.put('/articles/:id', { preHandler: requirePermission('edit articles|publish articles') }, updateArticle)
app.delete('/articles/:id', { preHandler: requirePermission('delete artcles') }, deleteArticle) // type error
```

`createGuards<typeof rbac>()` works too. `createGuards()` also takes the shared options shown above.

A guard without names, or with options before a name, is a type error too. The guards exported by the package
still accept any string. See [Typed names](/basic-usage/typed-names).

## Teams

When the engine is created with `teams: true`, resolve the current team per request:

```ts
const rbac = createRbac({ adapter, teams: true })

await app.register(rbacPlugin, {
  rbac,
  getSubject: (request) => (request.user ? { type: 'user', id: request.user.id } : null),
  team: (request) => request.headers['x-team-id'] as string | undefined,
})
```

::: warning
The team id usually comes from user input (a header, a URL segment, the session). Make sure the user actually
belongs to that team — RBAC Evolution only checks roles and permissions **within** the team you give it. See
[Teams](/basic-usage/teams).
:::

## Guards for an API

`guard` selects which guard's roles and permissions are loaded. Register the plugin inside an encapsulated scope to
use a different guard for part of the app:

```ts
await app.register(
  async (api) => {
    await api.register(rbacPlugin, {
      rbac,
      guard: 'api',
      getSubject: (request) => (request.apiClient ? { type: 'client', id: request.apiClient.id } : null),
    })

    api.get('/reports', { preHandler: requirePermission('reports.view') }, handler)
  },
  { prefix: '/api' },
)
```

### Another guard per route

Every guard also takes a `guard` option: the check runs in that guard (`request.rbac.withScope({ guard })`) instead
of the plugin's, like spatie's `role:admin,api` / `permission:edit articles,api`. `request.rbac` itself is unchanged,
and a guest still gets `401`. `guard` is per route only: it is not a `createGuards()` default.

```ts
app.get('/api/admin', { preHandler: requireRole('admin', { guard: 'api' }) }, handler) // role:admin,api
app.get('/api/articles', { preHandler: requirePermission('articles.edit', { guard: 'api' }) }, handler)
app.get('/api/reports', { preHandler: canAny('reports.view', 'reports.export', { guard: 'api' }) }, handler)
```

See [Multiple guards](/basic-usage/multiple-guards).
