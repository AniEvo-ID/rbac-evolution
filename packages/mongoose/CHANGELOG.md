# @anievo-id/rbac-evolution-mongoose

## 1.2.0

### Minor Changes

- 54bbcc9: Temporary access: optional expiry on role assignments and direct permissions.
  
  - `assignRole()`, `givePermissionTo()`, `syncRoles()` and `syncPermissions()` take an optional last
    `{ expiresAt: Date | null }`. From `expiresAt` on, every check treats the link as absent: `can()`, `hasRole()`,
    `snapshot()`, `subjectsWithRole()` / `subjectsWithPermission()`, `teams()`, `revokeAll()` and `deleteTeam()`
    events. Expired rows stay in the database until `rbac.pruneExpired()` deletes them (no events).
  - Re-assigning: the latest call wins (`assignRole()` without `expiresAt` makes the link permanent). `syncRoles()` /
    `syncPermissions()` without `expiresAt` keep the expiry of the links that stay.
  - `rbac.for(subject).getRoleAssignments()` and `getDirectPermissionAssignments()` return each link with its
    `expiresAt`. `role.attached` / `permission.attached` (subject) payloads carry `expiresAt` with an expiry-enabled
    adapter, and are also emitted when a call changes the expiry of a held link.
  - Cached subject states and `teams()` entries never outlive the earliest expiry inside them: the entry TTL is
    capped, and the state carries its `validUntil` for shared stores that round TTLs. New `createRbac({ now })`
    option to inject the engine clock (tests).
  - **Opt-in per adapter, no schema change by default.** Expiry needs an `expires_at` column, so every adapter keeps
    the 1.1 behaviour (and never touches that column) unless created with `{ expiry: true }`:
    `new PrismaAdapter(prisma, { expiry: true })`, `drizzlePgAdapter(db, pgRbacSchema({ expiry: true }), { expiry: true })`,
    `kyselyAdapter(db, { expiry: true })`, `mongooseAdapter({ expiry: true })`, `new MemoryAdapter({ expiry: true })`.
    Giving an `expiresAt` to an adapter without it throws the new `RbacError` code `EXPIRY_NOT_SUPPORTED`, never
    granting permanent access.
  - Migrations: an optional `expiresAt` field in `schema/rbac.prisma`; `sql/{pg,sqlite,mysql}-expiry.sql` and
    `{pg,sqlite,mysql}RbacSchema({ expiry: true })` for Drizzle; `addRbacExpiryColumns()`, `rbacExpiryMigration()`
    and `createRbacTables({ expiry: true })` for Kysely; an optional `expiresAt` field on the Mongoose link schemas
    (no migration). See each adapter's upgrade steps.
  - `RbacAdapter` gets an optional `supportsExpiry` flag and three optional methods, `getSubjectRoleLinks()`,
    `getSubjectPermissionLinks()` and `deleteExpiredLinks()`; `attachSubject*()` and `getSubjectIdsWith*()` get an
    optional last argument that the engine only passes when `supportsExpiry` is `true`. Existing custom adapters keep
    working unchanged. The conformance suite runs its new expiry tests only for adapters that declare
    `supportsExpiry`.

### Patch Changes

- Updated dependencies [54bbcc9]
- Updated dependencies [54bbcc9]
- Updated dependencies [54bbcc9]
  - @anievo-id/rbac-evolution@1.2.0

## 1.1.0

### Minor Changes

- 278d65a: Remove a subject from everything, delete a team, and list a subject's teams.
  
  - `rbac.for(subject).revokeAll(options?)` removes every role and direct permission of the subject in the current
    guard and team (`syncRoles([])` plus `syncPermissions([])` in one call). `{ allGuards: true }` and
    `{ allTeams: true }` widen it; both together remove the subject from everything, like spatie does when a model
    is deleted. Emits `role.detached` / `permission.detached` per team and guard.
  - `rbac.deleteTeam(teamId)` removes every role and direct permission held in the team (any subject, any guard) and
    every role scoped to the team. Emits `role.detached` / `permission.detached` per subject and guard, then
    `role.deleted` per team role, and clears the cache. Throws `TEAMS_NOT_ENABLED` without `teams: true`.
  - `rbac.for(subject).teams(options?)` returns the ids of the teams where the subject has a role or a direct
    permission (current guard, or every guard with `{ allGuards: true }`). Cached like other lookups.
  - `RbacAdapter` gets three **optional** methods: `getSubjectLinks(subject)`, `getTeamLinks(teamId)` and
    `detachTeamLinks(teamId)`, with the `SubjectLinks`, `SubjectRoleLink` and `SubjectPermissionLink` types. Existing
    custom adapters keep working: `revokeAll()` in the current team only needs the required methods, `deleteTeam()`
    falls back to per-subject detaches without `detachTeamLinks`, and the calls that need `getSubjectLinks` or
    `getTeamLinks` throw an `RbacError` with the new code `ADAPTER_METHOD_MISSING` (before writing anything).
  - Every built-in adapter (memory, Prisma, Drizzle, Kysely, Mongoose) implements the three methods, with the same
    exact matching of subject and team ids as the other methods, whatever the database collation.
  - The conformance suite (`runAdapterTests`) tests the optional methods an adapter has, and skips the others.
  - The engine no longer ends up in client bundles that only use `wildcardImplies` (React, Vue, the Next.js
    middleware): a `static {}` block kept bundlers from tree-shaking it. Those bundles shrink by about 4.5 kB
    (minified and brotlied).

### Patch Changes

- Updated dependencies [278d65a]
- Updated dependencies [278d65a]
- Updated dependencies [278d65a]
  - @anievo-id/rbac-evolution@1.1.0

## 1.0.0

### Patch Changes

- Updated dependencies [a69ebb9]
  - @anievo-id/rbac-evolution@1.0.0

## 1.0.0-rc.0

### Patch Changes

- Updated dependencies [a69ebb9]
  - @anievo-id/rbac-evolution@1.0.0-rc.0

## 0.9.0

### Patch Changes

- 990af7c: Peer dependency ranges now match the versions CI tests. A new `peers` CI job installs the oldest supported version of each framework and ORM and runs that package's build, typecheck and tests. The old ranges claimed versions that don't work:

  - **Drizzle:** `drizzle-orm` `>=0.36` -> `>=0.38`. On 0.36 and 0.37 the MySQL and SQLite schemas don't type-check.
  - **Kysely:** `kysely` `>=0.27` -> `^0.28.0`. On 0.27, passing a `Transaction` to `kyselyAdapter()` is a type error. 0.29 moved `Migration` to `kysely/migration`, which breaks `rbacMigration()`.
  - **Prisma:** `@prisma/client` `>=5` -> `^5.12.0 || ^6.0.0`. The docs already required 5.12 (`createMany` on SQLite). Prisma 7 isn't tested yet.
  - **Mongoose:** `mongoose` `>=8` -> `^8.0.0`. Mongoose 9 isn't tested yet.

  Nothing changes at runtime. If your package manager now warns about an unmet peer, the warning was right before: that version was never tested.

- 990af7c: The npm README now follows the same short structure: install, example, link to the docs.
- Updated dependencies [990af7c]
- Updated dependencies [990af7c]
  - @anievo-id/rbac-evolution@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [3cc54d1]
  - @anievo-id/rbac-evolution@0.8.0

## 0.7.1

### Patch Changes

- 5bd0554: Options now accept an explicit `undefined` under TypeScript's `exactOptionalPropertyTypes`, with the same meaning as leaving the option out. Before, `rbac.for(user, { guard: process.env.GUARD })` or `rbacMiddleware({ rbac, getSubject, guard: maybeGuard })` failed to compile with that setting (TS2375/TS2379) although they worked at runtime, so the option had to be spread conditionally. Every optional option, prop and query field of every package is now declared `| undefined`.

  The `createGuards()` defaults of the Express, Fastify and Hono integrations now also treat `undefined` as "not set": `requireRole('admin', { onForbidden: undefined })` keeps the shared `onForbidden` instead of falling back to the built-in 403.

  Found by the new type tests, which now cover the public types of all 14 packages.

- Updated dependencies [5bd0554]
  - @anievo-id/rbac-evolution@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [71ce31d]
- Updated dependencies [3aca854]
- Updated dependencies [71ce31d]
  - @anievo-id/rbac-evolution@0.7.0

## 0.6.6

### Patch Changes

- @anievo-id/rbac-evolution@0.6.6

## 0.6.5

### Patch Changes

- @anievo-id/rbac-evolution@0.6.5

## 0.6.4

### Patch Changes

- d449204: Each package's npm page now links to its own page on the documentation site at https://creation.anievo.id/rbac-evolution/: the `homepage` field (shown as "Homepage" on npm) and a Documentation link at the top of the README. No code changes.
- Updated dependencies [d449204]
  - @anievo-id/rbac-evolution@0.6.4

## 0.6.3

### Patch Changes

- @anievo-id/rbac-evolution@0.6.3

## 0.6.2

### Patch Changes

- Updated dependencies [70a7cf2]
  - @anievo-id/rbac-evolution@0.6.2

## 0.6.1

### Patch Changes

- 8d97357: Faster reverse lookups (`subjectsWithRole()` / `subjectsWithPermission()`) on large tables:

  - Prisma: de-duplicates subject ids in the database with `groupBy` instead of loading every link row into JS. `PrismaRbacModelHasRoleDelegate` / `PrismaRbacModelHasPermissionDelegate` now include `groupBy` (every generated `PrismaClient` has it).
  - Mongoose: uses an aggregation (`$group`) instead of `distinct`, whose single result document is capped at 16 MB (roughly 400k ids).
  - @anievo-id/rbac-evolution@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [7cef7cb]
  - @anievo-id/rbac-evolution@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [e9f2c48]
  - @anievo-id/rbac-evolution@0.5.0

## 0.4.1

### Patch Changes

- @anievo-id/rbac-evolution@0.4.1

## 0.4.0

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

- 2f5c74e: Add two storage adapters:

  - `@anievo-id/rbac-evolution-kysely`: one Kysely adapter for PostgreSQL, MySQL, SQLite and (experimental) SQL Server, using the same five spatie tables and conventions as the Drizzle and Prisma adapters. Ships typed table interfaces (`RbacDatabase`), `createRbacTables` / `dropRbacTables` and a Kysely `Migration` (`rbacMigration`).
  - `@anievo-id/rbac-evolution-mongoose`: a Mongoose adapter for MongoDB with five collections mirroring the spatie tables, ObjectId string ids, idempotent upsert-based attach and unique indexes.

### Patch Changes

- Updated dependencies [b20a7cf]
  - @anievo-id/rbac-evolution@0.3.0
