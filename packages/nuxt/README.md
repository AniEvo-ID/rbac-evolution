# @anievo-id/rbac-evolution-nuxt

Nuxt 3 and 4 module for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): the Vue directives and
components, the user's snapshot hydrated from SSR, `definePageMeta({ rbac })` route rules and Nitro helpers for
server-side checks.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-nuxt nuxt vue
```

## Usage

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@anievo-id/rbac-evolution-nuxt'],
  rbac: { wildcard: true }, // must mirror createRbac({ wildcard })
})
```

```ts
// server/utils/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-nuxt/server'

export const rbac = createRbac({ adapter: yourAdapter, wildcard: true })
export const rbacServer = createRbacServer({ rbac, getSubject: (event) => getUserSubject(event) }) // yours

// server/middleware/rbac.ts:   export default defineEventHandler((event) => rbacServer.resolve(event))
// server/api/articles/[id].delete.ts:   await rbacServer.requirePermission(event, 'articles.delete')
```

In pages: `definePageMeta({ rbac: { permission: 'articles.edit' } })`, `useCan('articles.publish')`,
`v-can="'articles.delete'"` and `<HasRole role="admin">`.

> Client checks only decide what the UI shows. Enforce access in server routes with `rbacServer.require*()`.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/nuxt

## License

MIT
