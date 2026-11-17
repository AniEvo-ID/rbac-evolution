# Elysia

`@anievo-id/rbac-evolution-elysia` adds RBAC Evolution to [Elysia](https://elysiajs.com) apps: one plugin that
resolves the current user's access into the context, and guards (`requirePermission`, `requireRole` and
`requireRoleOrPermission`) used as `beforeHandle` hooks. They mirror spatie/laravel-permission's `permission`,
`role` and `role_or_permission` middleware.

It uses no Node-only APIs, so it runs wherever Elysia runs: **Bun** first, and Node, Deno and Cloudflare Workers
through Elysia's adapters. Guards behave exactly like the [Hono](/frameworks/hono) ones and return the same
response bodies.

## Installation

::: code-group

```bash [bun]
bun add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-elysia
```

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-elysia
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-elysia
```

:::

`elysia` (1.2 or newer) is a peer dependency.

## Setup

Authentication is up to you (`@elysiajs/jwt`, a session cookie, …). Register `rbacPlugin` and tell it how to find
the subject on the request. Every route registered after it gets `rbac` in its context.

```ts
import { Elysia } from 'elysia'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { rbacPlugin, requirePermission } from '@anievo-id/rbac-evolution-elysia'

const rbac = createRbac({ adapter: new MemoryAdapter() })

const app = new Elysia()
  .use(
    rbacPlugin({
      rbac,
      // Return null or undefined for guests.
      getSubject: async ({ headers }) => {
        const user = await getUserFromToken(headers.authorization)
        return user ? { type: 'user', id: user.id } : null
      },
    }),
  )
  .patch('/articles/:id', updateArticle, { beforeHandle: requirePermission('edit articles') })
  .listen(3000)
```

### `rbacPlugin` options

| Option | Type | Description |
| --- | --- | --- |
| `rbac` | `Rbac` | The engine from `createRbac()`. |
| `getSubject` | `(ctx) => Subject \| null \| undefined` (or a promise) | Finds the subject. `null` means a guest. |
| `guard` | `string` | The guard of the subject. Default: the engine's `defaultGuard`. |
| `team` | `(ctx) => TeamId \| undefined` (or a promise) | The current team, with `teams: true`. |
| `name` | `string` | Plugin name. Elysia registers a plugin with the same name and guard once. Default: `'rbac-evolution'`. |

`getSubject` and `team` get the request context (`request`, `headers`, and what earlier plugins added).

## `rbac` in the context

`rbac` is the subject's `SubjectRbac` (see [Roles](/basic-usage/roles) and [Permissions](/basic-usage/permissions)),
or `null` for guests:

```ts
app.get('/me', async ({ rbac }) => (rbac ? rbac.snapshot() : null))
```

## Route guards

Each guard is a `beforeHandle` hook. Pass it on a route, or to `app.guard()` for a group of routes:

```ts
app
  .get('/admin/stats', getStats, { beforeHandle: requireRole('admin') })
  .guard({ beforeHandle: requireRole('admin|editor') }, (group) =>
    group.get('/admin/articles', listArticles).delete('/admin/articles/:id', deleteArticle),
  )
```

A guard ends the request when the check fails, and lets it through otherwise. Several guards on one route all
have to pass: `{ beforeHandle: [requireRole('editor'), requirePermission('publish articles')] }`.

| Guard | Passes when | spatie |
| --- | --- | --- |
| `requirePermission('a')` | the subject has permission `a` | `permission:a` |
| `requirePermission('a\|b')` | `a` OR `b` | `permission:a\|b` |
| `requirePermission('a', 'b')` | `a` AND `b` (`{ any: true }` for OR) | |
| `canAny('a', 'b')` / `canAll('a', 'b')` | any / all of them | `canAny()` / `canAll()` (v8.5) |
| `requireRole('admin\|editor')` | any of the roles (`{ all: true }` for all) | `role:admin\|editor` |
| `requireRoleOrPermission('admin\|edit')` | a role OR a permission among the names | `role_or_permission:` |

Super-admins (`superAdminRoles`, a `before` hook) pass permission guards, like in every other integration.

## Responses

| Case | Status | Body |
| --- | --- | --- |
| Guest | `401` | `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }` |
| No access | `403` | `{ "error": "FORBIDDEN", "reason": "permission", "message": "User does not have the right permissions." }` |

`reason` is `permission`, `role` or `role_or_permission`. Add `{ exposeRequirements: true }` to a guard to include
the required names as `required`. Leave it off in production.

A guard used before `rbacPlugin()` throws `RbacPluginMissingError` (code `RBAC_PLUGIN_MISSING`).

## Custom handlers

`onUnauthenticated` and `onForbidden` return what to send instead: a `Response`, or any value Elysia can send.

```ts
app.get('/dashboard', dashboard, {
  beforeHandle: requireRole('admin', {
    onUnauthenticated: () => Response.redirect('/login', 302),
    onForbidden: (_ctx, { kind }) => new Response(`Missing ${kind}`, { status: 403 }),
  }),
})
```

### `createGuards`

Shared defaults for many routes:

```ts
import { createGuards } from '@anievo-id/rbac-evolution-elysia'

const { requirePermission, requireRole } = createGuards({
  onForbidden: () => new Response(null, { status: 404 }), // hide what exists
})
```

## Typed names

Pass the engine type to `createGuards` to check names at compile time. `rbacPlugin({ rbac })` infers it from the
engine, so `rbac` in the context is typed too:

```ts
import { createGuards } from '@anievo-id/rbac-evolution-elysia'

type AppRbac = {
  permissions: 'edit articles' | 'publish articles'
  roles: 'writer' | 'admin'
}

const typed = createRbac<AppRbac>({ adapter })
const guards = createGuards<typeof typed>()

guards.requirePermission('edit articles')
guards.requirePermission('edit artcles') // type error
```

See [Typed names](/basic-usage/typed-names).

## Teams

```ts
app.use(
  rbacPlugin({
    rbac,
    getSubject: ({ headers }) => (headers['x-user'] ? { type: 'user', id: headers['x-user'] } : null),
    team: ({ headers }) => headers['x-team'],
  }),
)
```

Checks run in that team. See [Teams](/basic-usage/teams).

## Guards for an API

Give an API its own plugin instance with `guard: 'api'` and a `name`, inside its own Elysia instance:

```ts
const api = new Elysia({ prefix: '/api' })
  .use(
    rbacPlugin({
      rbac,
      name: 'rbac-api',
      guard: 'api',
      getSubject: ({ headers }) => (headers['x-api-key'] ? { type: 'api_key', id: headers['x-api-key'] } : null),
    }),
  )
  .get('/reports', getReports, { beforeHandle: requirePermission('reports.view') })
```

To check one route in another guard, like spatie's `role:admin,api`, pass `{ guard: 'api' }` to the guard.
See [Guards](/basic-usage/guards) and [Public REST API with API keys](/use-cases/public-api).
