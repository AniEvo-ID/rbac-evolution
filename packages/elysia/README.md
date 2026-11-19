# @anievo-id/rbac-evolution-elysia

[Elysia](https://elysiajs.com) plugin for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): a typed
`rbac` in the request context, and permission and role guards as `beforeHandle` hooks. Bun first, also on Node,
Deno and Cloudflare Workers.

## Install

```bash
bun add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-elysia
```

## Usage

```ts
import { Elysia } from 'elysia'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { rbacPlugin, requirePermission, requireRole } from '@anievo-id/rbac-evolution-elysia'

const rbac = createRbac({ adapter: new MemoryAdapter() })

new Elysia()
  .use(
    rbacPlugin({
      rbac,
      getSubject: async ({ headers }) => {
        const user = await getUser(headers.authorization) // yours
        return user ? { type: 'user', id: user.id } : null
      },
    }),
  )
  .get('/me', ({ rbac }) => rbac?.getRoleNames() ?? [])
  .patch('/articles/:id', updateArticle, { beforeHandle: requirePermission('edit articles') })
  .guard({ beforeHandle: requireRole('admin|editor') }, (admin) => admin.get('/admin/stats', getStats))
  .listen(3000)
```

- Guests get `401`, users without access `403`, with the same JSON bodies as the other integrations. The required
  names are only added with `exposeRequirements: true`. Leave it off in production.
- `createGuards<typeof rbac>()` checks names at compile time; `onUnauthenticated` / `onForbidden` customize the
  responses.
- `guard: 'api'` and `team` on the plugin, `{ guard: 'api' }` on a guard (spatie's `role:admin,api`).

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/elysia

## License

MIT
