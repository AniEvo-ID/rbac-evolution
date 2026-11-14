# @anievo-id/rbac-evolution-nestjs

## 0.3.1

### Patch Changes

- a890bc2: Security and consistency fixes:

  - **nestjs**: `RbacGuard` no longer skips the check on repeat calls from long-lived contexts. A WebSocket client (or GraphQL context) that was denied once is now checked again on every message instead of being let through, and a role revoked during a connection takes effect on the next message. Handlers are only marked as enforced after every requirement passed, and only for HTTP requests and RPC messages.
  - **core**: a role/permission lookup that was in flight while roles or permissions changed no longer writes its stale result into the cache (which could keep a revoked permission alive until the cache TTL ran out).
  - **core**: `syncRoles()`, `syncPermissions()` and `rbac.role(...).syncPermissions()` now attach the new list first and then detach only what is no longer in it, so a failure midway leaves extra roles/permissions instead of none.

- Updated dependencies [a890bc2]
  - @anievo-id/rbac-evolution@0.3.1

## 0.3.0

### Minor Changes

- a4f9393: New framework integrations:

  - `@anievo-id/rbac-evolution-nestjs`: `RbacModule.forRoot()` / `forRootAsync()`, `RbacGuard`, `@RequirePermissions()`, `@RequireRoles()`, `@RequireRoleOrPermission()` and `@CurrentRbac()`, with the same semantics and 401/403 bodies as the Express package.
  - `@anievo-id/rbac-evolution-nuxt`: a Nuxt 3/4 module that installs the Vue integration, hydrates the snapshot from SSR, auto-imports `useRbac()` / `useCan()` & co., enforces `definePageMeta({ rbac })` with a route middleware, and provides `createRbacServer()` helpers for Nitro routes.

### Patch Changes

- Updated dependencies [b20a7cf]
  - @anievo-id/rbac-evolution@0.3.0
