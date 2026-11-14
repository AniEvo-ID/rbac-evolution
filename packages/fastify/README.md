# @anievo-id/rbac-evolution-fastify

📖 **[Documentation](https://app.anievo.id/rbac-evolution/frameworks/fastify)**

[Fastify](https://fastify.dev) plugin for [rbac-evolution](../core) — the counterpart of spatie/laravel-permission's
`role`, `permission` and `role_or_permission` middleware, as `preHandler` hooks. Requires **Fastify 5**.

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-fastify
```

## Setup

```ts
import Fastify from 'fastify'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { rbacPlugin, requirePermission, requireRole, requireRoleOrPermission } from '@anievo-id/rbac-evolution-fastify'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const app = Fastify()

await app.register(yourAuthPlugin) // your authentication runs first (e.g. @fastify/jwt, @fastify/session)

await app.register(rbacPlugin, {
  rbac,
  // return null/undefined for guests
  getSubject: (request) => (request.user ? { type: 'user', id: request.user.id } : null),
  guard: 'web', // optional, defaults to the engine's defaultGuard
  team: (request) => request.headers['x-team-id'] as string | undefined, // optional, only with createRbac({ teams: true })
  hook: 'preHandler', // optional: 'onRequest' | 'preValidation' | 'preHandler' (default)
})
```

The plugin (wrapped with `fastify-plugin`) decorates `request.rbac`: a `SubjectRbac` for the current subject,
or `null` for guests. It is typed through `FastifyRequest` module augmentation.

```ts
app.get('/me/permissions', async (request) => (request.rbac ? request.rbac.snapshot() : null))

app.post('/articles/:id/publish', async (request, reply) => {
  if (!(await request.rbac?.can('publish articles'))) return reply.code(403).send()
  // ...
})
```

The subject is resolved in a `preHandler` hook by default, so it runs after authentication done in
`onRequest` / `preValidation` hooks and before the route's own `preHandler` guards. Pick another `hook` if your
authentication runs elsewhere.

## Guards

Guards are `preHandler` hooks:

```ts
app.put('/articles/:id', { preHandler: requirePermission('edit articles') }, handler)
app.put('/articles/:id', { preHandler: requirePermission('edit articles|delete articles') }, handler) // any of
app.put('/articles/:id', { preHandler: requirePermission('edit articles', 'publish articles') }, handler) // all of
app.put('/articles/:id', { preHandler: requirePermission('edit articles', 'publish articles', { any: true }) }, handler)

app.get('/admin', { preHandler: requireRole('admin') }, handler)
app.get('/staff', { preHandler: requireRole('admin|editor') }, handler) // any of
app.get('/staff', { preHandler: requireRole('admin', 'editor') }, handler) // any of
app.get('/both', { preHandler: requireRole('writer', 'editor', { all: true }) }, handler) // all of

app.get('/dashboard', { preHandler: requireRoleOrPermission('admin|view dashboard') }, handler)

app.get('/combo', { preHandler: [requireRole('editor'), requirePermission('publish articles')] }, handler)

// a whole encapsulated scope
app.register(async (admin) => {
  admin.addHook('preHandler', requireRole('admin'))
  admin.get('/users', handler)
}, { prefix: '/admin' })
```

Arrays are accepted anywhere a name is (`requirePermission(['a', 'b'])` = all of).
Unknown permissions simply fail the check (no exception). Permission checks go through `can()`,
so `superAdminRoles` and the engine's `before` hook apply.

### Responses

- No subject (`request.rbac === null`) → **401** `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }`
- Not allowed → **403** `{ "error": "FORBIDDEN", "reason": "permission" | "role" | "role_or_permission", "message": "..." }`
- Plugin not registered for the route → throws `RbacMiddlewareMissingError` (`code: 'RBAC_MIDDLEWARE_MISSING'`, `statusCode: 500`)

The required names are not included in the 403 body unless you pass `exposeRequirements: true`
(like spatie's `display_permission_in_exception`).

### Custom handlers

Handlers must send a reply or throw. Per guard:

```ts
requirePermission('edit articles', {
  onUnauthenticated: (request, reply) => reply.redirect('/login'),
  onForbidden: (request, reply, { kind, requirements }) => reply.code(403).send({ message: 'Nope' }),
})
```

Or once for all guards:

```ts
import { createGuards } from '@anievo-id/rbac-evolution-fastify'

export const { requirePermission, requireRole, requireRoleOrPermission } = createGuards({
  onUnauthenticated: (request, reply) => reply.redirect('/login'),
  onForbidden: () => {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  },
})
```

## License

MIT
