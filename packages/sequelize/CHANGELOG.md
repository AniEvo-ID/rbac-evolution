# @anievo-id/rbac-evolution-sequelize

## 1.8.0

### Patch Changes

- @anievo-id/rbac-evolution@1.8.0
  - @anievo-id/rbac-evolution-kysely@1.8.0

## 1.7.0

### Minor Changes

- 42c1959: New package `@anievo-id/rbac-evolution-sequelize`: `sequelizeAdapter(sequelize)` stores roles and permissions through a Sequelize 6.1+ instance, on PostgreSQL, MySQL / MariaDB, SQLite and SQL Server. Pass the transaction of `sequelize.transaction()` to run inside it. `rbacMigration()` and `rbacExpiryMigration()` are migrations for sequelize-cli and Umzug that create the five tables (the same as the Kysely, TypeORM, Drizzle and Prisma adapters) and add the expiry columns. Under the hood it is the Kysely adapter, running its queries through `sequelize.query()` with bind parameters.

### Patch Changes

- @anievo-id/rbac-evolution@1.7.0
  - @anievo-id/rbac-evolution-kysely@1.7.0
