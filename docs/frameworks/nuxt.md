# Nuxt

`@anievo-id/rbac-evolution-nuxt` is a Nuxt 3 / 4 module that wires RBAC Evolution into the whole stack:

- installs the [Vue](/frameworks/vue) integration — `v-can`, `v-role`, `<Can>`, `<HasRole>`, `$can()` — as a plugin;
- **hydrates the snapshot from SSR**: the server resolves the user once, the client reuses it through `useState`;
- **auto-imports** `useRbac()`, `useCan()`, `useHasRole()` & co.;
- adds a **route middleware** driven by `definePageMeta({ rbac: { … } })`;
- ships **Nitro helpers** (`@anievo-id/rbac-evolution-nuxt/server`) to enforce access in API routes, with the same
  401 / 403 bodies as the [Express](/frameworks/express) package.

::: warning
Everything that runs in the browser only decides what the UI *shows*. Always enforce authorization in server routes.
See [Security](/best-practices/security).
:::

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-nuxt
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-nuxt
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-nuxt
```

:::

## Setup

### 1. Register the module

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@anievo-id/rbac-evolution-nuxt'],
  rbac: {
    wildcard: true, // must mirror createRbac({ wildcard })
    superAdminRoles: ['super-admin'],
    unauthenticatedRedirect: '/login',
    forbiddenRedirect: '/403',
  },
})
```

| Option                    | Default | Description                                                                 |
| ------------------------- | ------- | --------------------------------------------------------------------------- |
| `wildcard`                | `false` | Match permissions like `articles.*` on the client.                          |
| `superAdminRoles`         | `[]`    | Roles that pass every permission check on the client.                       |
| `directives`              | `true`  | Register `v-can` / `v-role`.                                                |
| `components`              | `true`  | Register `<Can>` / `<HasRole>`.                                             |
| `globalProperties`        | `true`  | Add `$can`, `$hasRole`, … to templates.                                     |
| `middleware`              | `true`  | Register the global `rbac` route middleware.                                |
| `unauthenticatedRedirect` | `''`    | Where the middleware sends guests. Empty = show a 401 error page.          |
| `forbiddenRedirect`       | `''`    | Where the middleware sends users without access. Empty = 403 error page.   |

The options end up in `runtimeConfig.public.rbac`, so they can also be overridden with
`NUXT_PUBLIC_RBAC_*` environment variables.

### 2. Resolve the subject on the server

Create the engine and the server helpers in `server/utils` (auto-imported in every server file):

```ts
// server/utils/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-nuxt/server'
import type { H3Event } from 'h3'

export const rbac = createRbac({ adapter: yourAdapter })

export const rbacServer = createRbacServer({
  rbac,
  // Return null or undefined for guests.
  getSubject: async (event: H3Event) => {
    const session = await getUserSession(event) // your auth (nuxt-auth-utils, a JWT, …)
    return session.user ? { type: 'user', id: session.user.id } : null
  },
})
```

Then resolve it for every request with a server middleware:

```ts
// server/middleware/rbac.ts
export default defineEventHandler((event) => rbacServer.resolve(event))
```

`resolve(event)` stores the subject's `SubjectRbac` (or `null` for guests) on `event.context.rbac`. During SSR the
module's plugin reads it, calls `snapshot()` and stores `{ roles, permissions }` with `useState`; Nuxt serializes it
into the payload, so the client starts with the same data — no extra request, no flash of hidden buttons.

### `createRbacServer` options

| Option               | Type                                                    | Description                                                     |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| `rbac`               | `Rbac`                                                  | Your `createRbac(...)` instance. **Required.**                  |
| `getSubject`         | `(event) => Subject \| null \| undefined \| Promise<…>` | Resolves the current subject. **Required.**                     |
| `guard`              | `string`                                                | Guard name. Defaults to the engine's `defaultGuard`.            |
| `team`               | `(event) => TeamId \| undefined \| Promise<…>`          | Current team. Only for engines created with `teams: true`.      |
| `exposeRequirements` | `boolean`                                               | Add the required names to 403 bodies (`required`). Default `false`. |

## Composables

All composables are auto-imported. They work in components, plugins and route middleware.

```vue
<script setup lang="ts">
const props = defineProps<{ type: string }>()

const canEdit = useCan('articles.edit')
const canEditThis = useCan(() => `${props.type}.edit`) // reactive name
const isStaff = useHasRole('admin|editor')

const rbac = useRbac()
</script>

<template>
  <button v-if="canEdit">Edit</button>
  <span v-if="rbac.isGuest()">Log in to edit</span>
</template>
```

`useCan`, `useCannot`, `useCanAny`, `useCanAll`, `useHasRole`, `useHasAnyRole` and `useHasAllRoles` return a
`ComputedRef<boolean>` with the same matching rules as the [Vue composables](/frameworks/vue#composables).

`useRbac()` returns the instance (also available as `useNuxtApp().$rbac`): the synchronous checks of the Vue
package (`can`, `canAny`, `hasRole`, …, `snapshot`, `isSuperAdmin()`) plus:

- `setSnapshot(snapshot | null)` — replaces the snapshot **and** the SSR state;
- `isGuest()` — `true` when the server resolved no subject, or after `setSnapshot(null)`.

### After login and logout

```ts
// e.g. server/api/me/permissions.get.ts
export default defineEventHandler((event) => rbacServer.snapshot(event))
```

```ts
async function onLogin() {
  useRbac().setSnapshot(await $fetch('/api/me/permissions'))
}

function onLogout() {
  useRbac().setSnapshot(null)
}
```

## Directives and components

The Vue plugin is installed for you, so everything from the [Vue](/frameworks/vue) page works in Nuxt templates:

```vue
<template>
  <button v-can="'articles.delete'">Delete</button>
  <a v-role="'admin|editor'" href="/admin">Admin</a>

  <Can permission="articles.publish">
    <PublishButton />
    <template #fallback>Ask an editor to publish.</template>
  </Can>

  <HasRole role="admin">Admin tools</HasRole>
</template>
```

Directives render `display: none` during SSR when the check fails, so the server HTML already matches the client.

## Protecting pages

Add a `rbac` rule to a page; the module's global `rbac` route middleware enforces it on the server render and on
client-side navigation.

```vue
<script setup lang="ts">
definePageMeta({
  rbac: { permission: 'articles.edit' },
})
</script>
```

| Rule                                          | Passes when the user has…                       |
| --------------------------------------------- | ----------------------------------------------- |
| `{ permission: 'a' }`                         | the permission                                  |
| `{ permission: ['a', 'b'] }`                  | **all** of them                                 |
| `{ permission: 'a\|b' }`                      | **any** of them                                 |
| `{ permission: ['a', 'b'], any: true }`       | **any** of them                                 |
| `{ role: 'admin\|editor' }` / `['admin', 'editor']` | **any** of the roles                      |
| `{ role: ['writer', 'editor'], all: true }`   | **all** of the roles                            |
| `{ roleOrPermission: 'admin\|articles.edit' }` | any of the names, as a role or a permission    |

When several keys are set, all of them must pass. These are the same semantics as the Express guards and the
NestJS decorators.

A key that is present but `undefined` (for example `permission: config.missingName`) fails closed: guests get a
401 and everyone else a 403, instead of the page silently becoming public.

When the check fails:

- **guests** go to `guestRedirect` (per route) or the module's `unauthenticatedRedirect`; without one, navigation is
  aborted with a **401** error;
- **users without access** go to `redirect` (per route) or the module's `forbiddenRedirect`; without one, navigation is
  aborted with a **403** error.

```ts
definePageMeta({
  rbac: { role: 'admin', redirect: '/', guestRedirect: '/login' },
})
```

The error's `data` carries the Express body (`{ error, reason, message }`), available in `error.vue`.
Set `middleware: false` in the module options to register your own middleware instead; the pure
`evaluateRouteRule(useRbac(), rule, useRbac().isGuest())` helper is exported from
`@anievo-id/rbac-evolution-nuxt/rule` for that purpose.

::: tip
Page rules check the client-side snapshot. They improve UX, but API routes still need their own checks.
:::

## Server routes

`createRbacServer()` returns helpers that mirror the Express guards:

<!-- doc-test: skip -->
```ts
// server/api/articles/index.post.ts
export default defineEventHandler(async (event) => {
  const subject = await rbacServer.requirePermission(event, 'articles.create')
  // subject is the SubjectRbac — use it for finer checks
})

// server/api/articles/[id].delete.ts
export default defineEventHandler(async (event) => {
  await rbacServer.requirePermission(event, 'articles.delete|articles.moderate') // any
})

// server/api/admin/stats.get.ts
export default defineEventHandler(async (event) => {
  await rbacServer.requireRole(event, 'admin', 'auditor') // any; { all: true } for all
})
```

| Helper                                          | Semantics                                                   |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `requirePermission(event, ...names, options?)`  | all arguments; pipes = any; `{ any: true }`                 |
| `canAny(event, ...names, options?)` / `canAll(...)` | any of the permissions / every entry (spatie v8.5)      |
| `requireRole(event, ...names, options?)`        | any of the roles; `{ all: true }`                           |
| `requireRoleOrPermission(event, ...names, options?)` | any of the names, as a role or a permission            |
| `resolve(event)`                                | the `SubjectRbac` or `null` (cached per helper; the first one to resolve also sets `event.context.rbac`) |
| `snapshot(event)`                               | `{ roles, permissions }` or `null`                          |

Failures throw an `RbacHttpError` that h3 / Nitro send as an HTTP error:

```json
{
  "statusCode": 403,
  "statusMessage": "Forbidden",
  "message": "User does not have the right permissions.",
  "data": { "error": "FORBIDDEN", "reason": "permission", "message": "User does not have the right permissions." }
}
```

A guest gets `401` with `data: { "error": "UNAUTHENTICATED", "message": "User is not logged in." }`.
`data` is exactly the body of the Express and NestJS packages.

### Another guard per route

Every `require*` / `can*` helper also takes a trailing `{ guard }` option: that check runs in that guard
(`subject.withScope({ guard })`) instead of the server's, like spatie's `role:admin,api` /
`permission:edit articles,api`. The returned subject is in that guard; `event.context.rbac` is unchanged, and a guest
still gets `401`.

```ts
// server/api/admin/index.get.ts
export default defineEventHandler(async (event) => {
  await rbacServer.requireRole(event, 'admin', { guard: 'api' }) // role:admin,api
  await rbacServer.canAny(event, 'reports.view', 'reports.export', { guard: 'api' })
})
```

## Typed names

If the engine has typed names (`createRbac<AppRbac>()`), `createRbacServer` picks them up from `rbac`. Then a typo
in a server helper is a compile error. Every name is checked, including each part of a `'a|b'` list.

```ts
const rbac = createRbac<AppRbac>({ adapter })
export const rbacServer = createRbacServer({ rbac, getSubject })

await rbacServer.requirePermission(event, 'articles.edit|articles.publish') // ok
await rbacServer.requireRole(event, 'admn') // type error

// The subject they return has the names too
const subject = await rbacServer.requirePermission(event, 'articles.edit')
await subject.can('articles.pubish') // type error
```

`resolve(event)` and every `require*` / `can*` return a `SubjectRbac<AppRbac>`. Use them for checks inside a
handler rather than `event.context.rbac`, which h3 types loosely.

If you set the event type yourself, pass the names type too: `createRbacServer<MyEvent, AppRbac>(...)`.
With an untyped engine, any string is accepted. Route rules and the client stay untyped.
See [Typed names](/basic-usage/typed-names).

## TypeScript

The module augments `PageMeta`, so `definePageMeta({ rbac })` is typed, and Nuxt generates the types of
`useNuxtApp().$rbac` and the auto-imported composables. Run `nuxi prepare` (or `nuxt dev`) after installing.

Full API: [reference](/api/nuxt/)
