---
'@anievo-id/rbac-evolution-hono': minor
'@anievo-id/rbac-evolution-fastify': minor
---

New server integrations:

- `@anievo-id/rbac-evolution-hono` — `rbacMiddleware()` sets a typed `c.var.rbac`, plus `requirePermission`, `requireRole`, `requireRoleOrPermission` and `createGuards` middleware. Runs on Node, Bun, Deno, Cloudflare Workers and edge runtimes.
- `@anievo-id/rbac-evolution-fastify` — `rbacPlugin` (fastify-plugin) decorates `request.rbac` (with `FastifyRequest` type augmentation), plus the same guards as `preHandler` hooks.

Both return the same 401/403 JSON bodies and follow the same guard semantics as `@anievo-id/rbac-evolution-express`.
