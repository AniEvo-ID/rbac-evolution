# @anievo-id/rbac-evolution-nuxt

Nuxt 3 / 4 module for [rbac-evolution](../core). It installs [`@anievo-id/rbac-evolution-vue`](../vue)
(`v-can`, `v-role`, `<Can>`, `<HasRole>`, `$can`), hydrates the user's snapshot from SSR, auto-imports
`useRbac()` / `useCan()` & co., adds a route middleware for `definePageMeta({ rbac })`, and ships Nitro helpers
for server-side enforcement.

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-nuxt
```

## Setup

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@anievo-id/rbac-evolution-nuxt'],
  rbac: {
    wildcard: true, // must mirror createRbac({ wildcard })
    superAdminRoles: ['super-admin'],
    unauthenticatedRedirect: '/login', // optional, otherwise a 401 error page
    forbiddenRedirect: '/403', // optional, otherwise a 403 error page
  },
})
```

Resolve the subject on the server — the module's plugin reads `event.context.rbac` during SSR and sends the
snapshot to the client through `useState`:

```ts
// server/utils/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-nuxt/server'

export const rbac = createRbac({ adapter: yourAdapter })

export const rbacServer = createRbacServer({
  rbac,
  getSubject: async (event) => {
    const user = await getUserFromSession(event) // your auth
    return user ? { type: 'user', id: user.id } : null
  },
})

// server/middleware/rbac.ts
export default defineEventHandler((event) => rbacServer.resolve(event))
```

## Pages & components

```vue
<script setup lang="ts">
definePageMeta({ rbac: { permission: 'articles.edit' } })

const canPublish = useCan('articles.publish')
const rbac = useRbac()
</script>

<template>
  <button v-if="canPublish">Publish</button>
  <button v-can="'articles.delete'">Delete</button>
  <HasRole role="admin">Admin tools</HasRole>
  <p v-if="rbac.isGuest()">Please log in</p>
</template>
```

Route rules use the Express semantics: `permission` (all; `'a|b'` = any; `any: true`), `role` (any; `all: true`),
`roleOrPermission` (any), plus per-route `redirect` / `guestRedirect`.

After login or logout, update the client: `useRbac().setSnapshot(await $fetch('/api/me/permissions'))` or
`useRbac().setSnapshot(null)`.

## Server-side enforcement

Client checks only decide what the UI shows. Enforce in API routes:

```ts
// server/api/articles/[id].delete.ts
export default defineEventHandler(async (event) => {
  const rbac = await rbacServer.requirePermission(event, 'articles.delete')
  // ...
})
```

`requirePermission`, `requireRole` and `requireRoleOrPermission` throw a 401 / 403 error whose `data` is the
Express body (`{ error, reason, message }`).
