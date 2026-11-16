# Kysely adapter

`@anievo-id/rbac-evolution-kysely` stores roles and permissions through [Kysely](https://kysely.dev). One adapter works with every Kysely dialect. It also ships typed table interfaces and helpers that create the tables.

| Dialect family | Kysely dialects | Status |
| --- | --- | --- |
| PostgreSQL | `PostgresDialect` (pg), PGlite, Neon, postgres.js, ... | Tested |
| MySQL | `MysqlDialect` (mysql2), PlanetScale, ... | Tested (MySQL 8) |
| SQLite | `SqliteDialect` (better-sqlite3), libsql / Turso, D1, Bun SQLite, ... | Tested |
| SQL Server | `MssqlDialect` (tedious) | Tested (SQL Server 2022) |

The adapter detects the dialect family from your `Kysely` instance. Third-party dialects that reuse Kysely's built-in adapters (nearly all of them) are detected too. If detection fails, pass `{ dialect }` explicitly.

## Install

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-kysely kysely
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-kysely kysely
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-kysely kysely
```

```bash [bun]
bun add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-kysely kysely
```

:::

`kysely` 0.28 is a peer dependency (0.29 moved `Migration` to `kysely/migration`, which `rbacMigration()` uses, and is not supported yet). Install your database driver as usual.

## Schema

The adapter uses the five tables described in the [adapters overview](/adapters/overview#the-five-tables), with the same [storage conventions](/adapters/overview#storage-conventions) as the Prisma and Drizzle adapters. Tables created by the Drizzle adapter's SQL files or by drizzle-kit work as they are.

### `createRbacTables`

```ts
import { createRbacTables } from '@anievo-id/rbac-evolution-kysely'

await createRbacTables(db) // dialect detected from db
await createRbacTables(db, { dialect: 'mysql', prefix: 'rbac_' })
```

It creates the tables with their primary keys, unique constraints, foreign keys and indexes. Tables that already exist are skipped, so running it twice is harmless. `dropRbacTables(db, { prefix? })` drops the tables.

### With the Kysely migrator

`rbacMigration(options?)` returns a Kysely `Migration` object (`up` creates the tables, `down` drops them):

```ts
import { Migrator } from 'kysely'
import { rbacMigration } from '@anievo-id/rbac-evolution-kysely'

const migrator = new Migrator({
  db,
  provider: {
    async getMigrations() {
      return { '0001_rbac': rbacMigration(), ...yourMigrations }
    },
  },
})

await migrator.migrateToLatest()
```

If your migrations live in files (for example with `kysely-ctl`), call the helpers from one:

```ts
// migrations/0001_rbac.ts
import type { Kysely } from 'kysely'
import { createRbacTables, dropRbacTables } from '@anievo-id/rbac-evolution-kysely'

export const up = (db: Kysely<any>) => createRbacTables(db)
export const down = (db: Kysely<any>) => dropRbacTables(db)
```

### Table prefix

If your database already has a `roles` or `permissions` table, use a `prefix`. It is added to every table, constraint and index name:

```ts
await createRbacTables(db, { prefix: 'rbac_' }) // rbac_permissions, rbac_roles, ...
const adapter = kyselyAdapter(db, { prefix: 'rbac_' })
```

::: warning Use the same prefix everywhere
The adapter reads the unprefixed tables unless you pass the same `prefix` to `kyselyAdapter()`.
:::

### Column types

| Column | PostgreSQL | MySQL | SQLite | SQL Server |
| --- | --- | --- | --- | --- |
| `id` | `serial` | `integer auto_increment` | `integer autoincrement` | `integer identity` |
| `name`, `guard_name`, `subject_type`, `subject_id`, `team_id` | `text` | `varchar(255)` utf8mb4, `utf8mb4_bin` | `text` | `nvarchar(255)`, `Latin1_General_100_BIN2` |
| `created_at`, `updated_at` | `timestamptz` | `datetime` | `integer` (unix seconds) | `datetime2` |

On MySQL and SQL Server the string columns use a binary collation (`utf8mb4_bin`, `Latin1_General_100_BIN2`), so `'Edit'` and `'edit'` are different names, as on PostgreSQL and SQLite.

::: warning SQL Server tables created before 0.6.6
Older versions created the SQL Server columns with the database's default collation, which is usually case-insensitive: `'Edit'` and `'edit'` were treated as the same name. `createRbacTables` skips tables that already exist, so recreate them (or change the column collation) to get case-sensitive names.
:::

## Typing your `Database`

`RbacDatabase` describes the five tables. Extend it in your Kysely `Database` type to query them with full types:

```ts
import type { RbacDatabase } from '@anievo-id/rbac-evolution-kysely'

interface Database extends RbacDatabase {
  users: UsersTable
}

// With a prefix, pass it as a type argument:
interface PrefixedDatabase extends RbacDatabase<'rbac_'> {
  users: UsersTable
}
```

The table interfaces are also exported one by one: `PermissionsTable`, `RolesTable`, `RoleHasPermissionsTable`, `ModelHasRolesTable` and `ModelHasPermissionsTable`. The adapter itself accepts any `Kysely<DB>`, so this step is optional.

## Adapter

<!-- doc-test: skip -->
```ts
kyselyAdapter(db, options?: { dialect?: RbacDialect; prefix?: string }): KyselyRbacAdapter
```

`RbacDialect` is `'postgres' | 'mysql' | 'sqlite' | 'mssql'`.

::: code-group

```ts [PostgreSQL]
import { createRbac } from '@anievo-id/rbac-evolution'
import { kyselyAdapter } from '@anievo-id/rbac-evolution-kysely'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }) }),
})

export const rbac = createRbac({ adapter: kyselyAdapter(db) })
```

```ts [MySQL]
import { createRbac } from '@anievo-id/rbac-evolution'
import { kyselyAdapter } from '@anievo-id/rbac-evolution-kysely'
import { Kysely, MysqlDialect } from 'kysely'
import { createPool } from 'mysql2'

const db = new Kysely<Database>({
  dialect: new MysqlDialect({ pool: createPool({ uri: process.env.DATABASE_URL }) }),
})

export const rbac = createRbac({ adapter: kyselyAdapter(db) })
```

```ts [SQLite]
import { createRbac } from '@anievo-id/rbac-evolution'
import { kyselyAdapter } from '@anievo-id/rbac-evolution-kysely'
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

const db = new Kysely<Database>({
  dialect: new SqliteDialect({ database: new SQLite('local.db') }),
})

export const rbac = createRbac({ adapter: kyselyAdapter(db) })
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

### Exports

| Export | Kind |
| --- | --- |
| `kyselyAdapter(db, options?)`, `KyselyRbacAdapter` | function / class |
| `createRbacTables(db, options?)`, `dropRbacTables(db, options?)`, `rbacMigration(options?)` | functions |
| `detectDialect(db)`, `tableNames(options?)` | functions |
| `RbacDatabase<Prefix>`, `PermissionsTable`, `RolesTable`, `RoleHasPermissionsTable`, `ModelHasRolesTable`, `ModelHasPermissionsTable` | types |
| `RbacDialect`, `KyselyAdapterOptions`, `RbacMigrationOptions`, `RbacTableOptions`, `RbacTableNames`, `RbacTimestamp` | types |

## Behaviour notes

- **Ids.** Role and permission ids are integers and come back as `number`. Reverse lookups ([`subjectsWithRole` / `subjectsWithPermission`](/advanced/querying-subjects)) return subject ids as **strings**.
- **Non-integer ids are ignored.** If the engine passes an id that can't be an integer, the adapter drops it instead of throwing, because no row could match it anyway.
- **Idempotent attach.** Every `attach*` method is a single statement that skips existing links:

  | Dialect | Statement |
  | --- | --- |
  | PostgreSQL, SQLite | `INSERT ... ON CONFLICT DO NOTHING` |
  | MySQL | `INSERT ... ON DUPLICATE KEY UPDATE role_id = role_id` (a no-op; unlike `INSERT IGNORE` it doesn't hide other errors) |
  | SQL Server | `INSERT ... SELECT ... WHERE NOT EXISTS`, one row at a time; a duplicate-key error from a concurrent insert is ignored |

- **New ids** come from `RETURNING` on PostgreSQL and SQLite (3.35 or later), `OUTPUT` on SQL Server, and the driver's insert id on MySQL.
- **Link cleanup.** `deleteRole` and `deletePermission` delete the link rows themselves before deleting the row, so cleanup works even when SQLite foreign keys are off (the default).
- **Timestamps.** The adapter never writes or returns `created_at` / `updated_at`. They keep their default values.
- **SQL Server** is covered like the other dialects: the full conformance suite, including exact matching of names and subject ids, runs against SQL Server 2022 in CI. SQL Server ignores trailing spaces when it compares text; the adapter compares every row again in JavaScript, so this can't mix up subjects.

## Transactions

A delete runs a few statements one after another, and they are **not** wrapped in a transaction. To make several RBAC changes atomic, build a short-lived adapter on a Kysely transaction:

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { kyselyAdapter } from '@anievo-id/rbac-evolution-kysely'

await db.transaction().execute(async (trx) => {
  const txRbac = createRbac({ adapter: kyselyAdapter(trx), cache: false })

  await txRbac.deleteRole('legacy-editor')
  await txRbac.for({ type: 'user', id: 1 }).syncRoles('writer')
})

// The main instance still holds cached lookups from before the transaction.
await rbac.forgetCachedPermissions()
```

::: tip
`cache: false` on the transaction instance keeps uncommitted data out of any cache. After the commit, call `forgetCachedPermissions()` on your long-lived instance. See [Cache](/advanced/cache).
:::

Full API: [reference](/api/kysely/)
