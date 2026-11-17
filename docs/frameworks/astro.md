# Astro

`@anievo-id/rbac-evolution-astro` protects the pages, endpoints and middleware of an [Astro](https://astro.build) app
(Astro 4 to 7). Its guards mirror spatie/laravel-permission's `permission`, `role` and `role_or_permission`
middleware. A client island (React, Vue or Svelte) can show and hide UI from a snapshot of the subject.

A guard returns a standard `Response` when the check fails (a 401 or 403 with a JSON body, or a redirect), and
`undefined` when it passes. You return that `Response` from the page, the endpoint or the middleware. The package
does not import Astro itself.

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-astro
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-astro
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-astro
```

:::

The guards run on the server, so the pages that use them must be rendered on demand: `output: 'server'`, or
`export const prerender = false` on the page. On a prerendered page they run once, at build time, without a user.

## Setup

Create the server once. `getSubject` gets Astro's context (`Astro` in a page, `context` in an endpoint or a
middleware). Read the user there, for example from `locals.user`, which your auth middleware sets:

```ts
// src/env.d.ts
declare namespace App {
  interface Locals {
    user?: { id: string }
  }
}
```

```ts
// src/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-astro'

export const rbac = createRbac({ adapter })

export const rbacServer = createRbacServer({
  rbac,
  // Return null or undefined for guests.
  getSubject: ({ locals }) => (locals.user ? { type: 'user', id: locals.user.id } : null),
  // Send guests of a page to the login page instead of a 401.
  unauthenticatedRedirect: ({ url }) => `/login?redirectTo=${url.pathname}`,
})
```

### `createRbacServer` options

| Option | Type | Description |
| --- | --- | --- |
| `rbac` | `Rbac` | The engine from `createRbac()`. Its typed names flow into the guards. |
| `getSubject` | `(context) => Subject \| null \| undefined` (or a promise) | Finds the subject. `null` means a guest. |
| `guard` | `string` | The guard of the subject. Default: the engine's `defaultGuard`. |
| `team` | `(context) => TeamId \| undefined` (or a promise) | The current team, with `teams: true`. |
| `unauthenticatedRedirect` | `string \| (context) => string` | Redirect guests here (302) instead of the 401. |
| `forbiddenRedirect` | `string \| (context) => string` | Redirect users without access here (302) instead of the 403. |
| `onUnauthenticated` / `onForbidden` | `(context, guard) => Response` | Return the response to send. They win over the redirects. |
| `exposeRequirements` | `boolean` | Add the required names to the 403 body. Default: `false`. |

The subject is resolved once per request: a middleware, a page and its guards call `getSubject` once.

## Pages

Check in the frontmatter, and return the `Response` when there is one:

```astro
---
// src/pages/articles/[id]/edit.astro
import { rbacServer } from '../../../rbac'

const denied = await rbacServer.requirePermission(Astro, 'edit articles')
if (denied) return denied

const subject = await rbacServer.getRbac(Astro)
const canPublish = await subject?.can('publish articles')
---
<h1>Edit</h1>
{canPublish && <button>Publish</button>}
```

| Guard | Passes when | spatie |
| --- | --- | --- |
| `requirePermission(context, 'a')` | the subject has permission `a` | `permission:a` |
| `requirePermission(context, 'a\|b')` | `a` OR `b` | `permission:a\|b` |
| `requirePermission(context, 'a', 'b')` | `a` AND `b` (`{ any: true }` for OR) | |
| `canAny(context, 'a', 'b')` / `canAll(context, 'a', 'b')` | any / all of them | `canAny()` / `canAll()` (v8.5) |
| `requireRole(context, 'admin\|editor')` | any of the roles (`{ all: true }` for all) | `role:admin\|editor` |
| `requireRoleOrPermission(context, 'admin\|edit')` | a role OR a permission among the names | `role_or_permission:` |

Every option of `createRbacServer` (the redirects, the handlers, `exposeRequirements`) can also be passed to one
guard as its last argument, and wins there: `requireRole(Astro, 'admin', { forbiddenRedirect: '/upgrade' })`.
Super-admins (`superAdminRoles`, a `before` hook) pass permission guards, like in every other integration.

## Endpoints

An API route should answer a guest with the 401, not a redirect. Create a second server without the redirects
next to the first one, and use it in endpoints:

```ts
// src/rbac.ts (continued)
export const apiServer = createRbacServer({
  rbac,
  getSubject: ({ locals }) => (locals.user ? { type: 'user', id: locals.user.id } : null),
})
```

<!-- doc-test: skip -->
```ts
// src/pages/api/articles/[id].ts
import type { APIRoute } from 'astro'
import { apiServer } from '../../../rbac'

export const DELETE: APIRoute = async (context) => {
  const denied = await apiServer.requirePermission(context, 'delete articles')
  if (denied) return denied
  // ... delete context.params.id
  return new Response(null, { status: 204 })
}
```

## Middleware

Protect whole sections of the site in `src/middleware.ts`. Put it after the middleware that sets `locals.user`:

```ts
// src/middleware.ts
import { defineMiddleware, sequence } from 'astro:middleware'
import { rbacServer } from './rbac'

const rbacGuard = defineMiddleware(async (context, next) => {
  if (context.url.pathname.startsWith('/admin')) {
    const denied = await rbacServer.requireRole(context, 'admin')
    if (denied) return denied
  }
  return next()
})

export const onRequest = sequence(auth, rbacGuard)
```

## Responses

| Case | Returned | Body |
| --- | --- | --- |
| Guest | `401` | `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }` |
| No access | `403` | `{ "error": "FORBIDDEN", "reason": "permission", "message": "User does not have the right permissions." }` |
| A redirect option | `302` | none |

`reason` is `permission`, `role` or `role_or_permission`. To send something else, return it from `onForbidden` or
`onUnauthenticated`: `onForbidden: () => new Response('Not found', { status: 404 })`.

## Showing and hiding UI

In `.astro` templates, check the subject directly, as in the page above. For a client island, pass the snapshot as a
prop and give it to `<RbacProvider>` of the [React](/frameworks/react) package (or the [Vue](/frameworks/vue) and
[SvelteKit](/frameworks/sveltekit) components):

```astro
---
import { rbacServer } from '../rbac'
import Toolbar from '../components/Toolbar'

const snapshot = await rbacServer.getSnapshot(Astro) // null for guests
---
<Toolbar client:load snapshot={snapshot ?? { roles: [], permissions: [] }} />
```

```tsx
// src/components/Toolbar.tsx
import { Can, RbacProvider } from '@anievo-id/rbac-evolution-react'

export default function Toolbar({ snapshot }: { snapshot: RbacSnapshot }) {
  return (
    <RbacProvider snapshot={snapshot}>
      <Can permission="publish articles">
        <button>Publish</button>
      </Can>
    </RbacProvider>
  )
}
```

The snapshot only hides UI; the guards in pages and endpoints are what protect the data.

## Typed names

`createRbacServer({ rbac })` takes the names from a typed engine, so the guards check them at compile time:

```ts
type AppRbac = {
  permissions: 'edit articles' | 'publish articles'
  roles: 'writer' | 'admin'
}

const typed = createRbac<AppRbac>({ adapter })
const typedServer = createRbacServer({ rbac: typed, getSubject: () => null })

async function check(context: APIContext) {
  await typedServer.requirePermission(context, 'edit articles')
  await typedServer.requirePermission(context, 'edit artcles') // type error
}
```

See [Typed names](/basic-usage/typed-names).

## Teams and guards

```ts
export const teamServer = createRbacServer({
  rbac,
  getSubject: ({ locals }) => (locals.user ? { type: 'user', id: locals.user.id } : null),
  team: ({ params }) => params.teamId, // pages like src/pages/teams/[teamId]/...
})
```

Pass `guard: 'api'` to `createRbacServer` for the endpoints of an API, or `{ guard: 'api' }` to one guard, like
spatie's `role:admin,api`. See [Teams](/basic-usage/teams) and [Multiple guards](/basic-usage/multiple-guards).
