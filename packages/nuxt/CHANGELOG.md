# @anievo-id/rbac-evolution-nuxt

## 0.3.1

### Patch Changes

- Updated dependencies [a890bc2]
  - @anievo-id/rbac-evolution@0.3.1
  - @anievo-id/rbac-evolution-vue@0.3.1

## 0.3.0

### Minor Changes

- a4f9393: New framework integrations:

  - `@anievo-id/rbac-evolution-nestjs`: `RbacModule.forRoot()` / `forRootAsync()`, `RbacGuard`, `@RequirePermissions()`, `@RequireRoles()`, `@RequireRoleOrPermission()` and `@CurrentRbac()`, with the same semantics and 401/403 bodies as the Express package.
  - `@anievo-id/rbac-evolution-nuxt`: a Nuxt 3/4 module that installs the Vue integration, hydrates the snapshot from SSR, auto-imports `useRbac()` / `useCan()` & co., enforces `definePageMeta({ rbac })` with a route middleware, and provides `createRbacServer()` helpers for Nitro routes.

### Patch Changes

- Updated dependencies [b20a7cf]
  - @anievo-id/rbac-evolution@0.3.0
  - @anievo-id/rbac-evolution-vue@0.3.0
