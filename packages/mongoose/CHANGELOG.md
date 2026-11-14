# @anievo-id/rbac-evolution-mongoose

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
