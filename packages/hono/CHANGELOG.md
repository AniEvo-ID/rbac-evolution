# @anievo-id/rbac-evolution-hono

## 0.4.1

### Patch Changes

- @anievo-id/rbac-evolution@0.4.1

## 0.4.0

### Minor Changes

- 5812866: spatie v8 parity:

  - `canAny()` / `canAll()` route guards in Express, Fastify and Hono, `@CanAny` / `@CanAll` decorators in NestJS, and `canAny` / `canAll` server helpers in Nuxt (spatie v8.5 route macros).
  - `rbac.role(name).syncSubjects(subjectType, ids)` makes the given subjects the role's only holders of that type (spatie `Role::syncModels()`).

### Patch Changes

- Updated dependencies [9f8a114]
- Updated dependencies [5812866]
- Updated dependencies [ed88963]
  - @anievo-id/rbac-evolution@0.4.0

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
