# @anievo-id/rbac-evolution-fastify

## 0.3.1

### Patch Changes

- Updated dependencies [a890bc2]
  - @anievo-id/rbac-evolution@0.3.1

## 0.3.0

### Minor Changes

- b252674: New server integrations:

  - `@anievo-id/rbac-evolution-hono` — `rbacMiddleware()` sets a typed `c.var.rbac`, plus `requirePermission`, `requireRole`, `requireRoleOrPermission` and `createGuards` middleware. Runs on Node, Bun, Deno, Cloudflare Workers and edge runtimes.
  - `@anievo-id/rbac-evolution-fastify` — `rbacPlugin` (fastify-plugin) decorates `request.rbac` (with `FastifyRequest` type augmentation), plus the same guards as `preHandler` hooks.

  Both return the same 401/403 JSON bodies and follow the same guard semantics as `@anievo-id/rbac-evolution-express`.

### Patch Changes

- Updated dependencies [b20a7cf]
  - @anievo-id/rbac-evolution@0.3.0
