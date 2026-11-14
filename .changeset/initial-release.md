---
"@anievo-id/rbac-evolution": minor
"@anievo-id/rbac-evolution-prisma": minor
"@anievo-id/rbac-evolution-drizzle": minor
"@anievo-id/rbac-evolution-react": minor
"@anievo-id/rbac-evolution-next": minor
"@anievo-id/rbac-evolution-vue": minor
"@anievo-id/rbac-evolution-express": minor
---

Initial release of rbac-evolution — role & permission management for JS/TS, inspired by spatie/laravel-permission.

- **core**: roles, permissions, direct permissions, guards, wildcard permissions, teams, caching, super-admin (`before` / `superAdminRoles`), events, typed names, subject queries, `MemoryAdapter` and an adapter conformance test-suite (`/testing`).
- **prisma**: `PrismaAdapter` and a spatie-compatible Prisma schema.
- **drizzle**: PostgreSQL & SQLite schemas and adapters, plus plain SQL DDL.
- **react**: `RbacProvider`, `<Can>`, `<Cannot>`, `<HasRole>` and hooks.
- **next**: server helpers, server action & route handler guards, and middleware.
- **vue**: plugin, `v-can` / `v-role` directives, components and composables.
- **express**: `rbacMiddleware`, `requirePermission`, `requireRole`, `requireRoleOrPermission`.
