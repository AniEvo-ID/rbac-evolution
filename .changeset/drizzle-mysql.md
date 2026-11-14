---
'@anievo-id/rbac-evolution-drizzle': minor
---

Add MySQL support: `mysqlRbacSchema({ prefix? })`, `drizzleMysqlAdapter(db, schema?)`, a `./mysql` subpath export and `sql/mysql.sql`. String columns are bounded `varchar`s with a binary (`utf8mb4_bin`) collation so keys fit InnoDB's index limit and comparisons stay case-sensitive; attaches use a no-op `ON DUPLICATE KEY UPDATE` and inserts read ids with `$returningId()`. `DrizzleRbacAdapter` takes an optional third `dialect` argument (`'pg' | 'sqlite' | 'mysql'`, default `'pg'`).
