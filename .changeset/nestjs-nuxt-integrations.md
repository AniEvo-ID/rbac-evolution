---
'@anievo-id/rbac-evolution-nestjs': minor
'@anievo-id/rbac-evolution-nuxt': minor
---

New framework integrations:

- `@anievo-id/rbac-evolution-nestjs`: `RbacModule.forRoot()` / `forRootAsync()`, `RbacGuard`, `@RequirePermissions()`, `@RequireRoles()`, `@RequireRoleOrPermission()` and `@CurrentRbac()`, with the same semantics and 401/403 bodies as the Express package.
- `@anievo-id/rbac-evolution-nuxt`: a Nuxt 3/4 module that installs the Vue integration, hydrates the snapshot from SSR, auto-imports `useRbac()` / `useCan()` & co., enforces `definePageMeta({ rbac })` with a route middleware, and provides `createRbacServer()` helpers for Nitro routes.
