# React Router

`@anievo-id/rbac-evolution-react-router` protects the loaders and actions of a [React Router](https://reactrouter.com)
app in framework mode (React Router 7 and 8, and Remix). Its guards mirror spatie/laravel-permission's `permission`,
`role` and `role_or_permission` middleware. On the client, the components of the [React](/frameworks/react) package
read a snapshot your root loader returns.

The package does not import React Router itself: a guard throws a standard `Response` (a 401 or 403 with a JSON
body, or a redirect). Every version handles it the same way, so it works with any React Router 7+ or Remix 2 app.

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-react-router @anievo-id/rbac-evolution-react
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-react-router @anievo-id/rbac-evolution-react
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-react-router @anievo-id/rbac-evolution-react
```

:::

`@anievo-id/rbac-evolution-react` is only needed for the client components.

## Setup

Create the server once, in a server-only module. `getSubject` gets the loader's or action's args
(`{ request, params, context }`). Read the user from your session there.

```ts
// app/rbac.server.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-react-router'

export const rbac = createRbac({ adapter })

export const rbacServer = createRbacServer({
  rbac,
  // Return null or undefined for guests.
  getSubject: async ({ request }) => {
    const user = await getUser(request) // your session
    return user ? { type: 'user', id: user.id } : null
  },
  // Send guests of a page to the login page instead of a 401.
  unauthenticatedRedirect: ({ request }) => `/login?redirectTo=${new URL(request.url).pathname}`,
})
```

### `createRbacServer` options

| Option | Type | Description |
| --- | --- | --- |
| `rbac` | `Rbac` | The engine from `createRbac()`. Its typed names flow into the guards. |
| `getSubject` | `(args) => Subject \| null \| undefined` (or a promise) | Finds the subject. `null` means a guest. |
| `guard` | `string` | The guard of the subject. Default: the engine's `defaultGuard`. |
| `team` | `(args) => TeamId \| undefined` (or a promise) | The current team, with `teams: true`. |
| `unauthenticatedRedirect` | `string \| (args) => string` | Redirect guests here (302) instead of the 401. |
| `forbiddenRedirect` | `string \| (args) => string` | Redirect users without access here (302) instead of the 403. |
| `onUnauthenticated` / `onForbidden` | `(args, context) => Response` | Return or throw the response to send. They win over the redirects. |
| `exposeRequirements` | `boolean` | Add the required names to the 403 body. Default: `false`. |

The subject is resolved once per request: several guards in one loader call `getSubject` once.

## Guards in loaders and actions

Each guard takes the args first, then the names. It resolves to the subject (a `SubjectRbac`) when the check passes,
and throws otherwise:

```ts
// app/routes/articles.$id.edit.tsx
import { rbacServer } from '../rbac.server'

export async function loader(args: LoaderArgs) {
  await rbacServer.requirePermission(args, 'edit articles')
  return { article: await getArticle(args.params.id) }
}

export async function action(args: ActionArgs) {
  const subject = await rbacServer.requirePermission(args, 'edit articles')
  if (await subject.can('publish articles')) {
    // ...
  }
  return null
}
```

`LoaderArgs` and `ActionArgs` stand for your route's `Route.LoaderArgs` and `Route.ActionArgs` types.

| Guard | Passes when | spatie |
| --- | --- | --- |
| `requirePermission(args, 'a')` | the subject has permission `a` | `permission:a` |
| `requirePermission(args, 'a\|b')` | `a` OR `b` | `permission:a\|b` |
| `requirePermission(args, 'a', 'b')` | `a` AND `b` (`{ any: true }` for OR) | |
| `canAny(args, 'a', 'b')` / `canAll(args, 'a', 'b')` | any / all of them | `canAny()` / `canAll()` (v8.5) |
| `requireRole(args, 'admin\|editor')` | any of the roles (`{ all: true }` for all) | `role:admin\|editor` |
| `requireRoleOrPermission(args, 'admin\|edit')` | a role OR a permission among the names | `role_or_permission:` |

Every option of `createRbacServer` (the redirects, the handlers, `exposeRequirements`) can also be passed to one
guard as its last argument, and wins there: `requireRole(args, 'admin', { forbiddenRedirect: '/upgrade' })`.
Super-admins (`superAdminRoles`, a `before` hook) pass permission guards, like in every other integration.

## Responses

| Case | Thrown | Body |
| --- | --- | --- |
| Guest | `401` | `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }` |
| No access | `403` | `{ "error": "FORBIDDEN", "reason": "permission", "message": "User does not have the right permissions." }` |
| A redirect option | `302` | none |

The route's `ErrorBoundary` gets the 401 or 403: `isRouteErrorResponse(error)` is `true`, `error.status` is the
status, and `error.data` is the body above. `reason` is `permission`, `role` or `role_or_permission`.

## Showing and hiding UI

Return the snapshot from the root loader, and give it to `<RbacProvider>` of the [React](/frameworks/react) package:

```ts
// app/root.tsx (loader)
import { rbacServer } from './rbac.server'

export async function loader(args: LoaderArgs) {
  return { rbac: await rbacServer.getSnapshot(args) } // null for guests
}
```

```tsx
// app/root.tsx (component)
import { RbacProvider } from '@anievo-id/rbac-evolution-react'

export default function App({ loaderData }: { loaderData: { rbac: RbacSnapshot | null } }) {
  return (
    <RbacProvider snapshot={loaderData.rbac ?? { roles: [], permissions: [] }}>
      <Outlet />
    </RbacProvider>
  )
}
```

Then use `<Can>`, `<HasRole>` and `useCan()` anywhere below. The snapshot only hides UI; the guards in loaders and
actions are what protect the data.

## Typed names

`createRbacServer({ rbac })` takes the names from a typed engine, so the guards check them at compile time:

```ts
type AppRbac = {
  permissions: 'edit articles' | 'publish articles'
  roles: 'writer' | 'admin'
}

const typed = createRbac<AppRbac>({ adapter })
const typedServer = createRbacServer({ rbac: typed, getSubject: () => null })

async function loader(args: LoaderArgs) {
  await typedServer.requirePermission(args, 'edit articles')
  await typedServer.requirePermission(args, 'edit artcles') // type error
}
```

See [Typed names](/basic-usage/typed-names).

## Teams and guards

```ts
export const teamServer = createRbacServer({
  rbac,
  getSubject: async ({ request }) => {
    const user = await getUser(request)
    return user ? { type: 'user', id: user.id } : null
  },
  team: ({ params }) => params.teamId, // routes like /teams/:teamId/...
})
```

Pass `guard: 'api'` to `createRbacServer` for resource routes of an API, or `{ guard: 'api' }` to one guard, like
spatie's `role:admin,api`. See [Teams](/basic-usage/teams) and [Multiple guards](/basic-usage/multiple-guards).
