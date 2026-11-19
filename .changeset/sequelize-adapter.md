---
'@anievo-id/rbac-evolution-sequelize': minor
---

New package `@anievo-id/rbac-evolution-sequelize`: `sequelizeAdapter(sequelize)` stores roles and permissions through a Sequelize 6.1+ instance, on PostgreSQL, MySQL / MariaDB, SQLite and SQL Server. Pass the transaction of `sequelize.transaction()` to run inside it. `rbacMigration()` and `rbacExpiryMigration()` are migrations for sequelize-cli and Umzug that create the five tables (the same as the Kysely, TypeORM, Drizzle and Prisma adapters) and add the expiry columns. Under the hood it is the Kysely adapter, running its queries through `sequelize.query()` with bind parameters.
