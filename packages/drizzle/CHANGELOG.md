# @anievo-id/rbac-evolution-drizzle

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

- 71ce31d: **Security:** a subject id, subject type or team id that differs from another one only by trailing spaces (and, with Prisma on MySQL's default collation, by case or accents) no longer gets that subject's roles and permissions.

  SQL compares text with the column's collation. MySQL's `utf8mb4_bin` (used by the Drizzle and Kysely schemas) is PAD SPACE, SQL Server always ignores trailing spaces, and Prisma can't set a collation, so MySQL's case- and accent-insensitive default applies. A user with the id `'admin '` was therefore given the roles of `'admin'`, and with Prisma on MySQL so was `'ADMIN'`. This matters when subject ids are strings that users can influence, such as usernames.

  The adapters now re-check every row they read with exact string equality: role and permission lookups, a subject's links and the reverse lookups. Detaching a lookalike's links no longer removes the real subject's. No schema change or migration is needed. PostgreSQL, SQLite and MongoDB were not affected.

  Found by the new exact-matching tests of the adapter conformance suite, run against real MySQL and SQL Server servers in CI.

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

- 30bde26: Add MySQL support: `mysqlRbacSchema({ prefix? })`, `drizzleMysqlAdapter(db, schema?)`, a `./mysql` subpath export and `sql/mysql.sql`. String columns are bounded `varchar`s with a binary (`utf8mb4_bin`) collation so keys fit InnoDB's index limit and comparisons stay case-sensitive; attaches use a no-op `ON DUPLICATE KEY UPDATE` and inserts read ids with `$returningId()`. `DrizzleRbacAdapter` takes an optional third `dialect` argument (`'pg' | 'sqlite' | 'mysql'`, default `'pg'`).

### Patch Changes

- Updated dependencies [b20a7cf]
  - @anievo-id/rbac-evolution@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [f6c6b9b]
  - @anievo-id/rbac-evolution@0.2.1

## 0.2.0

### Patch Changes

- @anievo-id/rbac-evolution@0.2.0

## 0.1.1

### Patch Changes

- 6b7fef7: Add `author`, `homepage`, `bugs` and `engines` metadata to every package, so npm links to the right README, issue tracker and supported Node.js versions. First release published through npm Trusted Publishing with provenance.
- Updated dependencies [6b7fef7]
  - @anievo-id/rbac-evolution@0.1.1

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

### Patch Changes

- Updated dependencies [036fb78]
  - @anievo-id/rbac-evolution@0.1.0
