# @anievo-id/rbac-evolution-fastify

[Fastify](https://fastify.dev) 5 plugin for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): spatie's
`role`, `permission` and `role_or_permission` middleware as `preHandler` hooks.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-fastify fastify
```

## Usage

```ts
import Fastify from 'fastify'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { rbacPlugin, requirePermission, requireRole } from '@anievo-id/rbac-evolution-fastify'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const app = Fastify()

await app.register(yourAuthPlugin) // authentication runs first
await app.register(rbacPlugin, {
  rbac,
  getSubject: (request) => (request.user ? { type: 'user', id: request.user.id } : null),
})

app.put('/articles/:id', { preHandler: requirePermission('edit articles') }, updateArticle)
app.get('/admin', { preHandler: requireRole('admin') }, adminPage)
```

- The plugin decorates `request.rbac` (a `SubjectRbac`, or `null` for guests). It resolves the subject in a
  `preHandler` hook by default; set `hook: 'onRequest' | 'preValidation'` if your auth runs earlier.
- Guests get **401**, users without access get **403** `{ error, reason, message }`. The required names are only
  added with `exposeRequirements: true`. Leave it off in production.
- `createGuards<AppRbac>()` returns guards that type-check names against your `createRbac<AppRbac>()` type.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/fastify

## License

MIT
