---
'@anievo-id/rbac-evolution-typeorm': minor
---

New package `@anievo-id/rbac-evolution-typeorm`: `typeormAdapter(dataSource)` stores roles and permissions through a TypeORM 0.3.20+ or 1.x `DataSource`, on PostgreSQL, MySQL / MariaDB, SQLite and SQL Server. Pass the `EntityManager` of `dataSource.transaction()` to run inside that transaction. `rbacMigration()` and `rbacExpiryMigration()` are TypeORM migration classes that create the five tables (the same as the Kysely, Drizzle and Prisma adapters) and add the expiry columns. Under the hood it is the Kysely adapter, running its queries through TypeORM's query runners.
