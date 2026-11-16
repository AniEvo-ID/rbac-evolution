# @anievo-id/rbac-evolution

## 1.0.0

### Major Changes

- a69ebb9: **1.0: the stable API.** There are no breaking changes from 0.9: code that runs on 0.9 runs on 1.0. What changes is the promise. From 1.0 on, the public API of every package changes in a breaking way only in a new major version, every supported runtime, database and framework version is tested in CI, and security fixes have a supported version range.

  - What a patch, minor or major release may change, the support table and the deprecation policy: https://creation.anievo.id/rbac-evolution/guide/versioning
  - Coming from an older 0.x release: https://creation.anievo.id/rbac-evolution/guide/upgrading
  - Coming from spatie/laravel-permission: https://creation.anievo.id/rbac-evolution/guide/coming-from-laravel

## 1.0.0-rc.0

### Major Changes

- a69ebb9: **1.0: the stable API.** There are no breaking changes from 0.9: code that runs on 0.9 runs on 1.0. What changes is the promise. From 1.0 on, the public API of every package changes in a breaking way only in a new major version, every supported runtime, database and framework version is tested in CI, and security fixes have a supported version range.

  - What a patch, minor or major release may change, the support table and the deprecation policy: https://creation.anievo.id/rbac-evolution/guide/versioning
  - Coming from an older 0.x release: https://creation.anievo.id/rbac-evolution/guide/upgrading
  - Coming from spatie/laravel-permission: https://creation.anievo.id/rbac-evolution/guide/coming-from-laravel

## 0.9.0

### Minor Changes

- 990af7c: More of spatie/laravel-permission's API:

  - `rbac.for(user).hasAnyDirectPermission(...)` and `.hasAllDirectPermissions(...)`: direct permissions only, never throw.
  - `rbac.for(user).checkPermissionTo(name)`: `hasPermissionTo` that returns `false` instead of throwing for an unknown permission or another guard.
  - `rbac.for(user).withScope({ guard, team })`: the same subject in another guard or team, like passing the guard to a spatie check (`$user->hasRole('admin', 'api')`).
  - `rbac.findRoleById(id, { guard })` and `rbac.findPermissionById(id, { guard })`, like `Role::findById` and `Permission::findById`.
  - `rbac.rolesWithPermission(name, { guard, team })`: the roles that grant a permission, like `$permission->roles`.
  - React: `<UnlessRole role="banned">`, like `@unlessrole`.

### Patch Changes

- 990af7c: The npm README now follows the same short structure: install, example, link to the docs.

## 0.8.0

### Minor Changes

- 3cc54d1: Typed names now reach the integrations. With `createRbac<AppTypes>()`, a typo in a guard, a server helper or the CLI seed is a type error. Pipe lists like `'edit articles|delete articles'` are checked part by part, and the error names the wrong part (`UnknownRequirementName<"delete artcles">`).

  - **Express, Fastify, Hono:** `createGuards<AppTypes>()` or `createGuards<typeof rbac>()`.
  - **NestJS:** `createRbacDecorators<AppTypes>()` returns typed `RequirePermissions`, `RequireRoles`, `RequireRoleOrPermission`, `CanAny` and `CanAll`.
  - **Next.js:** `createNextRbac({ rbac })` takes the names from the engine you pass in.
  - **Nuxt:** `createRbacServer({ rbac })` takes the names from the engine you pass in. With an explicit event type, pass both: `createRbacServer<MyEvent, AppTypes>()`.
  - **CLI:** `defineConfig({ rbac, seed })` checks `seed` against the engine.
  - **Core:** exports `RequirementArgs`, `CheckRequirementName` and their error types, so custom integrations can do the same.

  The guards and decorators exported directly still accept any string. A guard called with no names, with only options, or with options before a name is now a type error everywhere, because it threw or ignored the options at runtime. Fix such calls, or move the options last.

## 0.7.1

### Patch Changes

- 5bd0554: Options now accept an explicit `undefined` under TypeScript's `exactOptionalPropertyTypes`, with the same meaning as leaving the option out. Before, `rbac.for(user, { guard: process.env.GUARD })` or `rbacMiddleware({ rbac, getSubject, guard: maybeGuard })` failed to compile with that setting (TS2375/TS2379) although they worked at runtime, so the option had to be spread conditionally. Every optional option, prop and query field of every package is now declared `| undefined`.

  The `createGuards()` defaults of the Express, Fastify and Hono integrations now also treat `undefined` as "not set": `requireRole('admin', { onForbidden: undefined })` keeps the shared `onForbidden` instead of falling back to the built-in 403.

  Found by the new type tests, which now cover the public types of all 14 packages.

## 0.7.0

### Minor Changes

- 71ce31d: The adapter conformance suite (`runAdapterTests` from `@anievo-id/rbac-evolution/testing`) now checks exact matching: role and permission names, guards, subject types, subject ids and team ids that differ only by case, accents or a trailing space must stay apart. A database collation that ignores case (MySQL's default, SQL Server's usual one) must not let a user `ADMIN` get the roles of `admin`. If you maintain a custom adapter, run the suite: these tests may fail where your columns use such a collation.
- 71ce31d: `Rbac` no longer exposes its engine internals. The ten members marked `@internal` (`events`, `gate`, `permissionExists`, `permissionMatches`, `remember`, `resolveGuard`, `resolvePermissions`, `resolveRoles`, `resolveTeam`, `visibleTeams`) are now truly private, so they can't be called by accident and can change freely before 1.0. Nothing documented changes: listen to events with `rbac.on()` / `rbac.off()`, and check permissions through `rbac.for(subject)` and `rbac.role(name)`.

  If your code called one of these members anyway, `rbac.defaultGuard`, `rbac.wildcard` and `rbac.teams` are still public, and `rbac.for(subject, { guard, team })` resolves guards and teams for you.

### Patch Changes

- 3aca854: The documentation moved to https://creation.anievo.id/rbac-evolution/. Each package's npm Homepage and Documentation link now point there.

## 0.6.6

## 0.6.5

## 0.6.4

### Patch Changes

- d449204: Each package's npm page now links to its own page on the documentation site at https://creation.anievo.id/rbac-evolution/: the `homepage` field (shown as "Homepage" on npm) and a Documentation link at the top of the README. No code changes.

## 0.6.3

## 0.6.2

### Patch Changes

- 70a7cf2: Fixes:

  - Core: two `role(...).syncSubjects()` calls running at the same time could remove each other's new holders and leave the role with none. Sync now only detaches holders it saw before attaching.
  - React: while `loading`, every checker method returns `false`, `cannot()` included (it returned `true`), and a stale snapshot passed with `loading` no longer grants anything. So `useCannot()` no longer shows "no access" UI before the snapshot arrives.

  Correction to the 0.6.0 notes: besides `requireRole(' | ')`, two more guards whose names are all blank used to answer 403 on every request and now throw a `TypeError` when they are defined: `requireRoleOrPermission(' ')` and `requirePermission('', { any: true })` (Express, Fastify, Hono). In Nuxt server helpers the same calls now reject with a `TypeError` (a 500) instead of a 403. They still never grant access. If names come from configuration, check them before building the guard.

## 0.6.1

## 0.6.0

### Minor Changes

- 7cef7cb: The framework integrations now share one requirement parser and checker from core (`permissionRequirement`, `roleRequirement`, `roleOrPermissionRequirement`, `satisfiesRequirement`, `splitRequirementArgs`, `REQUIREMENT_MESSAGES`), instead of five copies. Behaviour is unchanged, with one stricter case: in Express, Fastify and Hono, a role guard whose names are all blank (`requireRole(' | ')`) now throws a `TypeError` when it is defined, like NestJS and Nuxt already did, instead of answering 403 on every request.

## 0.5.0

### Patch Changes

- e9f2c48: - React: `<RbacProvider loading>` and Vue: `createRbacPlugin({ loading: true })`. While the snapshot is still being fetched, `<Can>`, `<Cannot>`, `<HasRole>`, `v-can` and `v-role` render nothing (not even a fallback or a `not` branch), so "read-only" content no longer flashes before the real permissions arrive. Exposed as `useRbac().loading` / `rbac.loading.value`.
  - Adapter test suite (`runAdapterTests`): reverse lookups (`getSubjectIdsWithRoles` / `getSubjectIdsWithPermissions`) are now checked per team.

## 0.4.1

## 0.4.0

### Minor Changes

- 5812866: spatie v8 parity:

  - `canAny()` / `canAll()` route guards in Express, Fastify and Hono, `@CanAny` / `@CanAll` decorators in NestJS, and `canAny` / `canAll` server helpers in Nuxt (spatie v8.5 route macros).
  - `rbac.role(name).syncSubjects(subjectType, ids)` makes the given subjects the role's only holders of that type (spatie `Role::syncModels()`).

### Patch Changes

- 9f8a114: Adapter fixes:

  - **drizzle, kysely**: `deleteRole()` / `deletePermission()` run their three deletes in one transaction on
    PostgreSQL, MySQL (and SQL Server for Kysely), so a failure midway can no longer strip a permission from every role
    while the permission itself survives. SQLite keeps running them without a transaction (sync-only drivers and
    libsql `:memory:` can't share one). Passing an existing transaction to the adapter still works.
  - **drizzle, kysely**: string ids must be written as integers. `'1e3'`, `'0x1A'` or `'7.0'` no longer resolve to a
    role or permission (same rule as the Prisma adapter).
  - **mongoose**: a failed first index build (e.g. a transient connection error) is retried on the next call instead
    of failing every later operation until the process restarts.
  - **core**: the shared adapter test suite (`runAdapterTests`) checks that ids only match when written exactly as stored.

- ed88963: CLI and cache fixes:

  - **cli**: `sync --prune` now requires `--yes` (or `--dry-run` to preview), so a typo in `--file` can't delete every
    role and permission without asking. **Scripts that run `sync --prune` need to add `--yes`.**
  - **cli**: subject and team ids become numbers only when that is lossless. `9007199254740993` (beyond
    `Number.MAX_SAFE_INTEGER`) and `007` stay strings instead of silently pointing at another subject.
  - **core**: `MemoryCache` keeps at most `maxEntries` entries (default 10 000) and drops the oldest write when full,
    so a long-running process checking many different users no longer grows without bound. Configure it with
    `new MemoryCache({ maxEntries })`.

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
