# @anievo-id/rbac-evolution-elysia

## 1.7.0

### Patch Changes

- @anievo-id/rbac-evolution@1.7.0

## 1.6.0

### Patch Changes

- @anievo-id/rbac-evolution@1.6.0

## 1.5.0

### Minor Changes

- 3aa5ef0: New package `@anievo-id/rbac-evolution-elysia`: an Elysia plugin (`rbacPlugin()`) that adds a typed `rbac` to the request context, and `requirePermission`, `requireRole`, `requireRoleOrPermission`, `canAny` and `canAll` guards used as `beforeHandle` hooks, on a route or a whole `app.guard()` group. Same responses, options (`guard`, `team`, `exposeRequirements`, custom handlers, `createGuards<AppRbac>()`) and semantics as the Hono integration. Bun first, also on Node, Deno and Cloudflare Workers.

### Patch Changes

- Updated dependencies [72e73a6]
  - @anievo-id/rbac-evolution@1.5.0
