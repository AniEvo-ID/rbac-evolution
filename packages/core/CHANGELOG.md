# @anievo-id/rbac-evolution

## 0.3.1

### Patch Changes

- a890bc2: Security and consistency fixes:

  - **nestjs**: `RbacGuard` no longer skips the check on repeat calls from long-lived contexts. A WebSocket client (or GraphQL context) that was denied once is now checked again on every message instead of being let through, and a role revoked during a connection takes effect on the next message. Handlers are only marked as enforced after every requirement passed, and only for HTTP requests and RPC messages.
  - **core**: a role/permission lookup that was in flight while roles or permissions changed no longer writes its stale result into the cache (which could keep a revoked permission alive until the cache TTL ran out).
  - **core**: `syncRoles()`, `syncPermissions()` and `rbac.role(...).syncPermissions()` now attach the new list first and then detach only what is no longer in it, so a failure midway leaves extra roles/permissions instead of none.

## 0.3.0

### Minor Changes

- b20a7cf: Add declarative seeding. Core: `rbac.sync(definition, { guard, team, prune, dryRun })` creates missing permissions and roles, syncs each role's permissions (`'*'` = every permission of the guard), optionally prunes what isn't declared, and returns a `{ created, updated, deleted }` summary (or the plan with `dryRun`). Supports multiple guards/teams via an array of definitions, typed names and the regular events; adds the `INVALID_SYNC_DEFINITION` error code. CLI: new `rbac-evolution sync [--prune] [--dry-run] [--file roles.json|.ts] [--json]` command reading `seed` from `rbac.config` (new `defineConfig` field) or a seed file.

## 0.2.1

### Patch Changes

- f6c6b9b: Fixes found while writing the docs:

  - **core**: `VERSION` is now read from package.json (it still said `0.1.0`).
  - **core**: the "does this permission exist?" check in `can()` / `hasPermissionTo()` is now cached per guard (cleared on every change), so repeated checks no longer query the database.
  - **next**: `createRbacMiddleware` in `rbac` mode now checks through the engine, so `superAdminRoles` and the `before` hook apply just like in `requirePermission()`.
  - **next**: 401/403 JSON bodies now match the Express package: `{ error: 'UNAUTHENTICATED', message }` and `{ error: 'FORBIDDEN', reason, message }`. If you parse the old `'Unauthenticated'` / `'Forbidden'` values, update them.
  - **react**: `canAll()`, `hasAllRoles()`, `useCanAll()` and `<Can allOf={[]}>` now deny an empty list, like the Vue package.

## 0.2.0

## 0.1.1

### Patch Changes

- 6b7fef7: Add `author`, `homepage`, `bugs` and `engines` metadata to every package, so npm links to the right README, issue tracker and supported Node.js versions. First release published through npm Trusted Publishing with provenance.

## 0.1.0

### Minor Changes

- 036fb78: Initial release of rbac-evolution — role & permission management for JS/TS, inspired by spatie/laravel-permission.

  - **core**: roles, permissions, direct permissions, guards, wildcard permissions, teams, caching, super-admin (`before` / `superAdminRoles`), events, typed names, subject queries, `MemoryAdapter` and an adapter conformance test-suite (`/testing`).
  - **prisma**: `PrismaAdapter` and a spatie-compatible Prisma schema.
  - **drizzle**: PostgreSQL & SQLite schemas and adapters, plus plain SQL DDL.
  - **react**: `RbacProvider`, `<Can>`, `<Cannot>`, `<HasRole>` and hooks.
  - **next**: server helpers, server action & route handler guards, and middleware.
  - **vue**: plugin, `v-can` / `v-role` directives, components and composables.
  - **express**: `rbacMiddleware`, `requirePermission`, `requireRole`, `requireRoleOrPermission`.
