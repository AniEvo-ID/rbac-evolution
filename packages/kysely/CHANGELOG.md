# @anievo-id/rbac-evolution-kysely

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
