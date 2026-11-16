# Vue

`@anievo-id/rbac-evolution-vue` brings role and permission checks to Vue 3 templates: a plugin, composables,
`v-can` / `v-role` directives, `<Can>` / `<HasRole>` components and `$can()`-style template helpers. Everything is
reactive — swap the snapshot and the UI updates.

::: warning UI only
These helpers run in the browser and only decide what is **shown**. Users can modify client-side state at will,
so every protected action must also be checked on the server — for example with
[`@anievo-id/rbac-evolution-express`](/frameworks/express). See [Security](/best-practices/security).
:::

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-vue
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-vue
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-vue
```

:::

Requires Vue 3.3 or newer.

## Setup

The server provides a snapshot of the current user's access — `await rbac.for(user).snapshot()`, which is
`{ roles: string[], permissions: string[] }`. Expose it from an endpoint:

```ts
// server (Express)
app.get('/api/me/permissions', async (req, res) => {
  res.json(req.rbac ? await req.rbac.snapshot() : null)
})
```

Then create the plugin and install it:

```ts
// src/rbac.ts
import { createRbacPlugin } from '@anievo-id/rbac-evolution-vue'

export const rbac = createRbacPlugin({
  wildcard: true, // mirror createRbac({ wildcard: true }) on the server
  superAdminRoles: ['super-admin'], // mirror the server's superAdminRoles
})
```

```ts
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { rbac } from './rbac'

const snapshot = await fetch('/api/me/permissions').then((r) => r.json())
rbac.setSnapshot(snapshot) // null for guests

createApp(App).use(rbac).use(router).mount('#app')
```

### Plugin options

| Option             | Type                    | Default | Description                                                          |
| ------------------ | ----------------------- | ------- | -------------------------------------------------------------------- |
| `snapshot`         | `RbacSnapshot \| null`  | `null`  | Initial snapshot. `null` = guest.                                    |
| `wildcard`         | `boolean`               | `false` | Treat granted permissions as wildcard patterns (`articles.*`).       |
| `superAdminRoles`  | `string[]`              | `[]`    | Roles that pass every permission check (not role checks).            |
| `loading`          | `boolean`               | `false` | Start in the loading state: `<Can>`, `<HasRole>`, `v-can`, `v-role` render nothing (no fallback, no `not` branch) until the first `setSnapshot()`. |
| `directives`       | `boolean`               | `true`  | Register `v-can` and `v-role` globally.                              |
| `components`       | `boolean`               | `true`  | Register `<Can>` and `<HasRole>` globally.                           |
| `globalProperties` | `boolean`               | `true`  | Add `$can`, `$hasRole`, … to templates.                              |

### Updating the snapshot

The object returned by `createRbacPlugin()` is also the RBAC instance. Call `setSnapshot()` after login, logout or
a role change — every directive, component and composable re-evaluates.

```ts
import { rbac } from './rbac'

async function onLogin() {
  rbac.setSnapshot(await fetch('/api/me/permissions').then((r) => r.json()))
}

function onLogout() {
  rbac.setSnapshot(null)
}
```

When the snapshot is fetched on the client, create the plugin with `loading: true`: nothing flashes before
`setSnapshot()` runs, and `rbac.loading.value` tells you it is still loading.

The current snapshot is available read-only as `rbac.snapshot.value`, and `rbac.isSuperAdmin()` tells you whether
the user has one of the `superAdminRoles`.

## Composables

Each composable returns a `ComputedRef<boolean>` and accepts a plain value, a ref or a getter, so dynamic names
stay reactive.

```vue
<script setup lang="ts">
import { useCan, useCanAny, useHasRole, useRbac } from '@anievo-id/rbac-evolution-vue'

const props = defineProps<{ type: string }>()

const canEdit = useCan('articles.edit')
const canModerate = useCanAny(['articles.delete', 'articles.archive'])
const canEditThis = useCan(() => `${props.type}.edit`) // re-evaluates when props.type changes
const isStaff = useHasRole('admin|editor')

const rbac = useRbac() // the instance: rbac.can(), rbac.hasRole(), rbac.snapshot, rbac.setSnapshot()
</script>

<template>
  <button v-if="canEdit">Edit</button>
  <button v-if="canModerate">Moderate</button>
</template>
```

| Composable          | `true` when the user…                                  |
| ------------------- | ------------------------------------------------------ |
| `useCan(x)`         | has the permission — or **all** of them for a list    |
| `useCannot(x)`      | fails `useCan(x)`                                      |
| `useCanAny(x)`      | has **any** of the permissions                         |
| `useCanAll(x)`      | has **all** of the permissions                         |
| `useHasRole(x)`     | has the role — or **any** of them (list or `'a\|b'`)   |
| `useHasAnyRole(x)`  | has **any** of the roles                               |
| `useHasAllRoles(x)` | has **all** of the roles                               |
| `useRbac()`         | — returns the instance; throws if the plugin is not installed |

## Directives

`v-can` and `v-role` hide their element with `display: none` (like `v-show`) when the check fails.

```vue
<template>
  <button v-can="'articles.edit'">Edit</button>
  <button v-can="['articles.edit', 'articles.publish']">Edit &amp; publish</button> <!-- all -->
  <button v-can.all="['articles.edit', 'articles.publish']">Edit &amp; publish</button>
  <button v-can.any="['articles.delete', 'articles.archive']">Moderate</button>
  <p v-can.not="'articles.edit'">Read only</p>

  <a v-role="'admin'" href="/admin">Admin</a>
  <a v-role="'admin|editor'" href="/staff">Staff</a> <!-- any, pipe syntax -->
  <a v-role="['admin', 'editor']" href="/staff">Staff</a> <!-- any -->
  <span v-role.all="['writer', 'editor']">Writer &amp; editor</span>
  <form v-role.not="'banned'">…</form>
</template>
```

| Directive | No modifier                     | `.any`        | `.all`       | `.not`           |
| --------- | ------------------------------- | ------------- | ------------ | ---------------- |
| `v-can`   | a list means **all**            | any of a list | all (explicit) | negates the check |
| `v-role`  | a list or `'a\|b'` means **any** | —            | all of them  | negates the check |

`.not` combines with the others: `v-can.any.not="[...]"` shows the element when the user has none of the
permissions.

::: tip Removing instead of hiding
Directives only hide elements; the markup is still in the DOM. If the element must not be rendered at all, use
`v-if="$can(...)"` or the `<Can>` component.
:::

## Components

`<Can>` and `<HasRole>` render their default slot when the check passes and the `#fallback` slot otherwise.

```vue
<template>
  <Can permission="articles.edit">
    <EditButton />
    <template #fallback>You can't edit this article.</template>
  </Can>

  <Can :any-of="['articles.delete', 'articles.archive']">…</Can>
  <Can :all-of="['articles.edit', 'articles.publish']">…</Can>
  <Can permission="articles.edit" not>Read only</Can>

  <HasRole role="admin">…</HasRole>
  <HasRole role="admin|editor">…</HasRole>
  <HasRole :all-of="['writer', 'editor']">…</HasRole>
  <HasRole role="banned" not>Post a comment</HasRole>
</template>
```

| Component   | Props                                       | Notes                                                    |
| ----------- | ------------------------------------------- | -------------------------------------------------------- |
| `<Can>`     | `permission`, `any-of`, `all-of`, `not`     | `permission` with a list means **all** of them.          |
| `<HasRole>` | `role`, `any-of`, `all-of`, `not`           | `role` with a list or `'a\|b'` means **any** of them.    |

If you set more than one condition prop, all must pass. A component without any condition renders the fallback.
Both components are registered globally by the plugin; to import them explicitly (e.g. with `components: false`):

```ts
import { Can, HasRole } from '@anievo-id/rbac-evolution-vue'
```

## Template helpers

With `globalProperties` enabled (the default), every template gets these helpers:

```vue
<template>
  <button v-if="$can('articles.edit')">Edit</button>
  <span v-if="$hasRole('admin')">Admin</span>
  <MenuItem v-if="$canAny(['reports.view', 'reports.export'])" to="/reports" />
</template>
```

Available: `$can`, `$cannot`, `$canAny`, `$canAll`, `$hasRole`, `$hasAnyRole`, `$hasAllRoles` and `$rbac` (the
instance). They are typed via `ComponentCustomProperties`, so there is nothing to configure for TypeScript.

## Router guard

Because the plugin object is the RBAC instance, you can use it outside components — for example in a Vue Router
navigation guard driven by route meta:

```ts
// src/router.ts
import { createRouter, createWebHistory } from 'vue-router'
import { rbac } from './rbac'

declare module 'vue-router' {
  interface RouteMeta {
    permission?: string | string[]
    role?: string
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./pages/Home.vue') },
    { path: '/admin', component: () => import('./pages/Admin.vue'), meta: { role: 'admin' } },
    {
      path: '/articles/:id/edit',
      component: () => import('./pages/EditArticle.vue'),
      meta: { permission: 'articles.edit' },
    },
    { path: '/forbidden', component: () => import('./pages/Forbidden.vue') },
  ],
})

router.beforeEach((to) => {
  if (to.meta.permission && !rbac.can(to.meta.permission)) return '/forbidden'
  if (to.meta.role && !rbac.hasRole(to.meta.role)) return '/forbidden'
})
```

::: warning
A router guard improves navigation, but the data behind `/admin` must still come from API endpoints that check
access on the server.
:::

## Matching rules

| Check                                            | One name | A list    | `'a\|b'` string        |
| ------------------------------------------------ | -------- | --------- | ---------------------- |
| `can` / `v-can` / `<Can permission>`             | has it   | **all**   | treated as one literal name |
| `canAny` / `v-can.any` / `<Can any-of>`          | has it   | any       | treated as one literal name |
| `hasRole` / `v-role` / `<HasRole role>`          | has it   | **any**   | any                    |
| `hasAllRoles` / `v-role.all` / `<HasRole all-of>` | has it  | all       | all                    |

- Pipe splitting (`'a|b'`) applies to **roles only**.
- An empty list never passes.
- `superAdminRoles` affects permission checks, not role checks.
- With `wildcard: true`, a granted `articles.*` satisfies `can('articles.edit')`. See
  [Wildcard permissions](/basic-usage/wildcard-permissions).
- A snapshot belongs to one guard and team; build it with the same scope you check on the server.

Full API: [reference](/api/vue/)
