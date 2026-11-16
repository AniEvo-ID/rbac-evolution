# Drizzle adapter

`@anievo-id/rbac-evolution-drizzle` stores roles and permissions through [Drizzle ORM](https://orm.drizzle.team). It ships the table definitions and an adapter factory for each supported dialect.

| Dialect | Entry point | Drivers |
| --- | --- | --- |
| PostgreSQL | `@anievo-id/rbac-evolution-drizzle/pg` | node-postgres, postgres.js, Neon, Vercel Postgres, PGlite, ... |
| SQLite | `@anievo-id/rbac-evolution-drizzle/sqlite` | libsql / Turso, better-sqlite3, Bun SQLite, Cloudflare D1, ... |
| MySQL | `@anievo-id/rbac-evolution-drizzle/mysql` | mysql2, PlanetScale, TiDB Serverless, ... (MySQL 8, MariaDB) |

The package root (`@anievo-id/rbac-evolution-drizzle`) re-exports everything from all three entry points.

## Install

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-drizzle drizzle-orm
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-drizzle drizzle-orm
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-drizzle drizzle-orm
```

```bash [bun]
bun add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-drizzle drizzle-orm
```

:::

`drizzle-orm` 0.38 or later is a peer dependency. Install your database driver as usual.

## Schema

The tables are built by a factory function, `pgRbacSchema()`, `sqliteRbacSchema()` or `mysqlRbacSchema()`. Each returns the five tables described in the [adapters overview](/adapters/overview#the-five-tables):

```ts
{ permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions }
```

### With drizzle-kit

drizzle-kit only finds tables that are **exported at the top level** of your schema file, so destructure the result:

::: code-group

```ts [PostgreSQL]
// db/schema.ts
import { pgRbacSchema } from '@anievo-id/rbac-evolution-drizzle/pg'

export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = pgRbacSchema()

// ...your own tables
```

```ts [SQLite]
// db/schema.ts
import { sqliteRbacSchema } from '@anievo-id/rbac-evolution-drizzle/sqlite'

export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = sqliteRbacSchema()

// ...your own tables
```

```ts [MySQL]
// db/schema.ts
import { mysqlRbacSchema } from '@anievo-id/rbac-evolution-drizzle/mysql'

export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = mysqlRbacSchema()

// ...your own tables
```

:::

Then generate and apply migrations as you normally would:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate   # or: npx drizzle-kit push
```

### Table prefix

If your database already has a `roles` or `permissions` table, pass a `prefix`. It is added to every table name, and also to the constraint and index names:

```ts
// db/schema.ts
import { pgRbacSchema } from '@anievo-id/rbac-evolution-drizzle/pg'

// rbac_permissions, rbac_roles, rbac_role_has_permissions, ...
export const rbacTables = pgRbacSchema({ prefix: 'rbac_' })

export const {
  permissions: rbacPermissions,
  roles: rbacRoles,
  roleHasPermissions: rbacRoleHasPermissions,
  modelHasRoles: rbacModelHasRoles,
  modelHasPermissions: rbacModelHasPermissions,
} = rbacTables
```

::: warning Pass the same schema to the adapter
With no schema argument, the adapter uses the **unprefixed** tables. When you use a prefix, pass the same schema object as the second argument (see [Prefixed schema](#prefixed-schema)).
:::

### Without drizzle-kit: plain SQL

If you manage migrations with another tool, use the DDL files that ship with the package:

| Dialect | File | Package export |
| --- | --- | --- |
| PostgreSQL | `node_modules/@anievo-id/rbac-evolution-drizzle/sql/pg.sql` | `@anievo-id/rbac-evolution-drizzle/sql/pg.sql` |
| SQLite | `node_modules/@anievo-id/rbac-evolution-drizzle/sql/sqlite.sql` | `@anievo-id/rbac-evolution-drizzle/sql/sqlite.sql` |
| MySQL | `node_modules/@anievo-id/rbac-evolution-drizzle/sql/mysql.sql` | `@anievo-id/rbac-evolution-drizzle/sql/mysql.sql` |

All files use `CREATE ... IF NOT EXISTS`, so running them twice is harmless. For example:

```bash
psql "$DATABASE_URL" -f node_modules/@anievo-id/rbac-evolution-drizzle/sql/pg.sql
mysql -u root -p my_app < node_modules/@anievo-id/rbac-evolution-drizzle/sql/mysql.sql
```

If you use a prefix, add it to every table, constraint and index name in the file.

### Column types

| Column | PostgreSQL | SQLite | MySQL |
| --- | --- | --- | --- |
| `id` | `serial` | `integer PRIMARY KEY AUTOINCREMENT` | `int AUTO_INCREMENT` |
| `name`, `guard_name` | `text` | `text` | `varchar(255)` |
| `subject_type`, `subject_id`, `team_id` | `text` | `text` | `varchar(191)` |
| `created_at`, `updated_at` | `timestamp with time zone DEFAULT now()` | `integer` unix seconds (Drizzle `mode: 'timestamp'` → `Date`) | `timestamp DEFAULT CURRENT_TIMESTAMP` |

`team_id` is `NOT NULL DEFAULT ''`, and `''` means global. See [storage conventions](/adapters/overview#storage-conventions).

::: info MySQL specifics
- **Bounded `varchar`s.** MySQL can't index a whole `TEXT` column, and InnoDB caps an index key at 3072 bytes (768 `utf8mb4` characters). The lengths above keep the `roles` unique key (701 characters) and the `model_has_*` primary keys (573 characters plus the integer id) under that limit. Subject ids and team ids longer than 191 characters are rejected by MySQL.
- **Exact comparisons.** The string columns use `CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`, so names, subject ids and team ids are compared case-sensitively, the same as on PostgreSQL and SQLite. With MySQL's default case-insensitive collation, `'aBc'` and `'ABC'` would be the same subject id. `utf8mb4_bin` ignores trailing spaces when comparing, so don't rely on trailing whitespace in names or ids.
- **Short prefixes.** MySQL identifiers are limited to 64 characters. drizzle-kit names foreign keys after the table and column (`rbac_model_has_permissions_permission_id_rbac_permissions_id_fk` is 63), so keep prefixes to about five characters.
:::

## Adapter

Each dialect has a factory function that takes a Drizzle database instance and, optionally, the schema object:

```ts
drizzlePgAdapter(db, schema?: PgRbacSchema): RbacAdapter
drizzleSqliteAdapter(db, schema?: SqliteRbacSchema): RbacAdapter
drizzleMysqlAdapter(db, schema?: MysqlRbacSchema): RbacAdapter
```

::: code-group

```ts [PostgreSQL]
import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzlePgAdapter } from '@anievo-id/rbac-evolution-drizzle/pg'
import { drizzle } from 'drizzle-orm/node-postgres'

const db = drizzle(process.env.DATABASE_URL!)

export const rbac = createRbac({ adapter: drizzlePgAdapter(db) })
```

```ts [SQLite]
import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzleSqliteAdapter } from '@anievo-id/rbac-evolution-drizzle/sqlite'
import { drizzle } from 'drizzle-orm/libsql'

const db = drizzle({ connection: { url: 'file:local.db' } })

export const rbac = createRbac({ adapter: drizzleSqliteAdapter(db) })
```

```ts [MySQL]
import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzleMysqlAdapter } from '@anievo-id/rbac-evolution-drizzle/mysql'
import { drizzle } from 'drizzle-orm/mysql2'

const db = drizzle(process.env.DATABASE_URL!)

export const rbac = createRbac({ adapter: drizzleMysqlAdapter(db) })
```

:::

From there it's the normal engine API:

```ts
await rbac.createPermission('edit articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

const user = rbac.for({ type: 'user', id: 1 })
await user.assignRole('writer')
await user.can('edit articles') // true
```

### Prefixed schema

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzlePgAdapter } from '@anievo-id/rbac-evolution-drizzle/pg'
import { db } from './db'
import { rbacTables } from './db/schema' // pgRbacSchema({ prefix: 'rbac_' })

export const rbac = createRbac({ adapter: drizzlePgAdapter(db, rbacTables) })
```

### Exports

| Export | From | Kind |
| --- | --- | --- |
| `pgRbacSchema(options?)`, `drizzlePgAdapter(db, schema?)` | `/pg` | functions |
| `sqliteRbacSchema(options?)`, `drizzleSqliteAdapter(db, schema?)` | `/sqlite` | functions |
| `mysqlRbacSchema(options?)`, `drizzleMysqlAdapter(db, schema?)` | `/mysql` | functions |
| `PgRbacSchema`, `SqliteRbacSchema`, `MysqlRbacSchema`, `RbacSchemaOptions` | `/pg`, `/sqlite`, `/mysql` | types |
| `DrizzleRbacAdapter`, `DrizzleDialect`, `RbacTables`, `RbacTableNames` | package root | class / types |

`RbacSchemaOptions` has one field, `prefix?: string` (default `''`).

## Behaviour notes

- **Ids.** Role and permission ids are integers and come back as `number`. Reverse lookups (`getSubjectIdsWithRoles`, `getSubjectIdsWithPermissions`) return subject ids as **strings**.
- **Non-integer ids are ignored.** If the engine passes an id that can't be an integer, the adapter drops it instead of throwing, because no row could match it anyway.
- **Idempotent attach.** Every `attach*` method is a single `INSERT ... ON CONFLICT DO NOTHING` (on MySQL, `INSERT ... ON DUPLICATE KEY UPDATE col = col`, a no-op update), so it is safe when requests race. Unlike `INSERT IGNORE`, the MySQL form still reports foreign-key errors.
- **Inserts on MySQL.** MySQL has no `INSERT ... RETURNING`, so `createPermission` / `createRole` read the generated id with Drizzle's `$returningId()`.
- **Link cleanup.** `deleteRole` and `deletePermission` delete the link rows themselves before deleting the row. This works even when SQLite foreign keys are off (the default). The `ON DELETE CASCADE` clauses take effect on SQLite only after `PRAGMA foreign_keys = ON` for each connection.
- **Timestamps.** The adapter never writes or returns `created_at` / `updated_at`. They keep their default values.

## Supported databases and how they are tested

Every dialect runs the shared conformance suite (`runAdapterTests` from `@anievo-id/rbac-evolution/testing`) plus dialect-specific tests:

| Dialect | Tested against | When |
| --- | --- | --- |
| PostgreSQL | PGlite (embedded PostgreSQL) | every test run |
| PostgreSQL | PostgreSQL 16 via node-postgres | when `PG_URL` is set (CI `databases` job) |
| SQLite | libsql in memory, foreign keys on and off | every test run |
| MySQL | MySQL 8 via mysql2 | when `MYSQL_URL` is set (CI `databases` job) |

Without `PG_URL` / `MYSQL_URL`, those suites show up as skipped (`... (skipped: MYSQL_URL not set)`). To run them locally, point the variables at a server you can create databases on; the tests work in their own `rbac_evolution_drizzle_test` database:

```bash
PG_URL=postgresql://postgres:postgres@localhost:5432/postgres \
MYSQL_URL=mysql://root:root@127.0.0.1:3306/mysql \
pnpm --filter @anievo-id/rbac-evolution-drizzle test
```

MariaDB uses the same schema but isn't covered by CI.

## Transactions

A delete runs a few statements one after another (links first, then the row), and they are **not** wrapped in a transaction. If you need several RBAC changes to be atomic, build a short-lived adapter on the transaction object. Drizzle transactions are database instances, so the factories accept them:

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzlePgAdapter } from '@anievo-id/rbac-evolution-drizzle/pg'

await db.transaction(async (tx) => {
  const txRbac = createRbac({ adapter: drizzlePgAdapter(tx), cache: false })

  await txRbac.deleteRole('legacy-editor')
  await txRbac.for({ type: 'user', id: 1 }).syncRoles('writer')
})

// The main instance still holds cached lookups from before the transaction.
await rbac.forgetCachedPermissions()
```

::: tip
`cache: false` on the transaction instance keeps uncommitted data out of any cache. After the commit, call `forgetCachedPermissions()` on your long-lived instance. Each instance owns its own cache and doesn't know about changes made through another instance. See [Cache](/advanced/cache).
:::
