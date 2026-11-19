# TanStack Start

`@anievo-id/rbac-evolution-tanstack-start` protects the server functions, middleware and server routes of a
[TanStack Start](https://tanstack.com/start) app (React or Solid). Its guards mirror spatie/laravel-permission's
`permission`, `role` and `role_or_permission` middleware. On the client, the components of the
[React](/frameworks/react) package read a snapshot your root route loads.

A guard takes the `Request` and throws a standard `Response` when the check fails: a 401 or 403 with a JSON body,
or what your handler returns, such as TanStack Router's `redirect()`. TanStack Start sends a thrown `Response` as
the response of the server function, the middleware or the server route. The package does not import TanStack
itself.

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-tanstack-start @anievo-id/rbac-evolution-react
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-tanstack-start @anievo-id/rbac-evolution-react
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-tanstack-start @anievo-id/rbac-evolution-react
```

:::

`@anievo-id/rbac-evolution-react` is only needed for the client components.

## Setup

Create the server once, in a module only server code imports. `getSubject` gets the `Request`. Read the user from
your session there:

```ts
// src/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-tanstack-start'

export const rbac = createRbac({ adapter })

export const rbacServer = createRbacServer({
  rbac,
  // Return null or undefined for guests.
  getSubject: async (request) => {
    const user = await getUser(request) // your session
    return user ? { type: 'user', id: user.id } : null
  },
})
```

### `createRbacServer` options

| Option | Type | Description |
| --- | --- | --- |
| `rbac` | `Rbac` | The engine from `createRbac()`. Its typed names flow into the guards. |
| `getSubject` | `(request) => Subject \| null \| undefined` (or a promise) | Finds the subject. `null` means a guest. |
| `guard` | `string` | The guard of the subject. Default: the engine's `defaultGuard`. |
| `team` | `(request) => TeamId \| undefined` (or a promise) | The current team, with `teams: true`. |
| `onUnauthenticated` / `onForbidden` | `(request, context) => Response` | Return (or throw) what to send instead of the 401 / 403. |
| `exposeRequirements` | `boolean` | Add the required names to the 403 body. Default: `false`. |

The subject is resolved once per `Request`: several guards in one server function call `getSubject` once.

## Server functions

Server functions are where your data is, so check there. `getRequest()` gives the current request:

```ts
// src/server/articles.ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { rbacServer } from '../rbac'

export const updateArticle = createServerFn({ method: 'POST' })
  .validator((data: { id: string; title: string }) => data)
  .handler(async ({ data }) => {
    const subject = await rbacServer.requirePermission(getRequest(), 'edit articles')
    if (await subject.can('publish articles')) {
      // ...
    }
    return { id: data.id }
  })
```

The caller's promise rejects with the 401 or 403 `Response`, and the HTTP status is kept.

| Guard | Passes when | spatie |
| --- | --- | --- |
| `requirePermission(request, 'a')` | the subject has permission `a` | `permission:a` |
| `requirePermission(request, 'a\|b')` | `a` OR `b` | `permission:a\|b` |
| `requirePermission(request, 'a', 'b')` | `a` AND `b` (`{ any: true }` for OR) | |
| `canAny(request, 'a', 'b')` / `canAll(request, 'a', 'b')` | any / all of them | `canAny()` / `canAll()` (v8.5) |
| `requireRole(request, 'admin\|editor')` | any of the roles (`{ all: true }` for all) | `role:admin\|editor` |
| `requireRoleOrPermission(request, 'admin\|edit')` | a role OR a permission among the names | `role_or_permission:` |

Every option of `createRbacServer` (the handlers, `exposeRequirements`) can also be passed to one guard as its last
argument, and wins there. Super-admins (`superAdminRoles`, a `before` hook) pass permission guards, like in every
other integration.

## Middleware

Wrap a guard in a function middleware to reuse it, and pass the subject on in the context:

```ts
// src/middleware.ts
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { rbacServer } from './rbac'

export const adminOnly = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const rbac = await rbacServer.requireRole(getRequest(), 'admin')
  return next({ context: { rbac } })
})
```

```ts
// src/server/stats.ts
import { createServerFn } from '@tanstack/react-start'
import { adminOnly } from '../middleware'

export const getStats = createServerFn()
  .middleware([adminOnly])
  .handler(async ({ context }) => ({ roles: await context.rbac.getRoleNames() }))
```

A request middleware (`createMiddleware().server(({ request, next }) => ...)`) gets `request` directly, and can
guard every request in `src/start.ts`.

## Server routes

```ts
// src/routes/api.articles.$id.ts
import { createFileRoute } from '@tanstack/react-router'
import { rbacServer } from '../rbac'

export const Route = createFileRoute('/api/articles/$id')({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        await rbacServer.requirePermission(request, 'delete articles')
        // ... delete params.id
        return new Response(null, { status: 204 })
      },
    },
  },
})
```

## Pages: redirect guests

`beforeLoad` runs on the client too, so it can't call the guards directly. Call a server function from it, and make
the guard return TanStack Router's `redirect()` instead of the 401:

```ts
// src/server/admin.ts
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { rbacServer } from '../rbac'

export const ensureAdmin = createServerFn().handler(async () => {
  await rbacServer.requireRole(getRequest(), 'admin', {
    onUnauthenticated: () => redirect({ to: '/login' }),
    onForbidden: () => redirect({ to: '/' }),
  })
  return null
})
```

```ts
// src/routes/admin.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ensureAdmin } from '../server/admin'

export const Route = createFileRoute('/admin')({
  beforeLoad: () => ensureAdmin(),
})
```

Use `redirect()`, not a plain 302 `Response`: `fetch` would follow a plain redirect inside the server function call,
and the router would never see it. `beforeLoad` only guards the page; the server functions the page calls still need
their own checks.

## Responses

| Case | Thrown | Body |
| --- | --- | --- |
| Guest | `401` | `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }` |
| No access | `403` | `{ "error": "FORBIDDEN", "reason": "permission", "message": "User does not have the right permissions." }` |
| A handler | what it returns | |

`reason` is `permission`, `role` or `role_or_permission`.

## Showing and hiding UI

Load the snapshot in the root route with a server function, and give it to `<RbacProvider>` of the
[React](/frameworks/react) package:

```ts
// src/server/rbac-snapshot.ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { rbacServer } from '../rbac'

export const getRbacSnapshot = createServerFn().handler(() => rbacServer.getSnapshot(getRequest())) // null for guests
```

```tsx
// src/routes/__root.tsx (component)
import { RbacProvider } from '@anievo-id/rbac-evolution-react'

function RootComponent({ snapshot }: { snapshot: RbacSnapshot | null }) {
  return (
    <RbacProvider snapshot={snapshot ?? { roles: [], permissions: [] }}>
      <Outlet />
    </RbacProvider>
  )
}
```

Return `getRbacSnapshot()` from the root route's `loader` and read it with `Route.useLoaderData()`. Then use
`<Can>`, `<HasRole>` and `useCan()` anywhere below. The snapshot only hides UI; the guards in server functions are
what protect the data.

## Typed names

`createRbacServer({ rbac })` takes the names from a typed engine, so the guards check them at compile time:

```ts
type AppRbac = {
  permissions: 'edit articles' | 'publish articles'
  roles: 'writer' | 'admin'
}

const typed = createRbac<AppRbac>({ adapter })
const typedServer = createRbacServer({ rbac: typed, getSubject: () => null })

async function check(request: Request) {
  await typedServer.requirePermission(request, 'edit articles')
  await typedServer.requirePermission(request, 'edit artcles') // type error
}
```

See [Typed names](/basic-usage/typed-names).

## Teams and guards

```ts
export const teamServer = createRbacServer({
  rbac,
  getSubject: async (request) => {
    const user = await getUser(request)
    return user ? { type: 'user', id: user.id } : null
  },
  // URLs like /teams/42/...
  team: (request) => new URL(request.url).pathname.split('/')[2],
})
```

Pass `guard: 'api'` to `createRbacServer` for the server routes of an API, or `{ guard: 'api' }` to one guard, like
spatie's `role:admin,api`. See [Teams](/basic-usage/teams) and [Multiple guards](/basic-usage/multiple-guards).
