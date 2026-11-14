# @anievo-id/rbac-evolution-kysely

[Kysely](https://kysely.dev) storage adapter for [rbac-evolution](https://github.com/AniEvo-ID/rbac-evolution) — roles & permissions for JS/TS, inspired by spatie/laravel-permission.

One adapter class for every Kysely dialect:

| Dialect family | Kysely dialects                                                           | Status                       |
| -------------- | ------------------------------------------------------------------------- | ---------------------------- |
| PostgreSQL     | `PostgresDialect` (pg), PGlite, Neon, postgres.js, ...                     | Tested (PGlite + real server) |
| MySQL          | `MysqlDialect` (mysql2), PlanetScale, ... (MySQL 8+; MariaDB should work) | Tested (CI, real server)     |
| SQLite         | `SqliteDialect` (better-sqlite3), libsql / Turso, D1, Bun SQLite, ...      | Tested (libsql)              |
| SQL Server     | `MssqlDialect` (tedious)                                                   | Experimental (not tested in CI) |

The dialect is detected from your `Kysely` instance. Pass `{ dialect }` if detection fails.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-kysely kysely
```

`kysely` 0.27 or later is a peer dependency. Install your database driver as usual.

## Tables

Same layout and conventions as the Drizzle and Prisma adapters (spatie/laravel-permission):

| Table                   | Columns                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `permissions`           | `id` (auto-increment), `name`, `guard_name`, `created_at`, `updated_at` — unique `(name, guard_name)` |
| `roles`                 | `id` (auto-increment), `name`, `guard_name`, `team_id`, `created_at`, `updated_at` — unique `(name, guard_name, team_id)` |
| `role_has_permissions`  | `role_id`, `permission_id` — composite PK                                                   |
| `model_has_roles`       | `role_id`, `subject_type`, `subject_id`, `team_id` — composite PK                           |
| `model_has_permissions` | `permission_id`, `subject_type`, `subject_id`, `team_id` — composite PK                     |

- `subject_id` is a string column, so subjects may have numeric **or** string (UUID, cuid, ...) ids.
- `team_id` is `NOT NULL DEFAULT ''`; `''` means "global / no team". `Role.teamId` comes back as `null` for global
  roles and as a **string** otherwise (`teamId: 1` → `'1'`).
- `created_at` / `updated_at` default to the current time and are never read or written by the adapter.
- Link tables reference `roles` / `permissions` with `ON DELETE CASCADE`; the adapter also deletes links itself.

Tables created by the Drizzle adapter's `sql/pg.sql` / `sql/sqlite.sql` (or by `drizzle-kit`) are compatible.

## Schema setup

### `createRbacTables`

```ts
import { createRbacTables } from '@anievo-id/rbac-evolution-kysely'

await createRbacTables(db) // dialect detected; existing tables are skipped
await createRbacTables(db, { dialect: 'mysql', prefix: 'rbac_' })
```

`dropRbacTables(db, { prefix? })` drops them again.

### As a Kysely migration

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

Or call it from a migration file:

```ts
// migrations/0001_rbac.ts
import type { Kysely } from 'kysely'
import { createRbacTables, dropRbacTables } from '@anievo-id/rbac-evolution-kysely'

export const up = (db: Kysely<any>) => createRbacTables(db)
export const down = (db: Kysely<any>) => dropRbacTables(db)
```

### Column types

| Column                                                     | PostgreSQL    | MySQL                                     | SQLite                | SQL Server      |
| ---------------------------------------------------------- | ------------- | ----------------------------------------- | --------------------- | --------------- |
| `id`                                                       | `serial`      | `integer auto_increment`                  | `integer autoincrement` | `integer identity` |
| `name`, `guard_name`, `subject_type`, `subject_id`, `team_id` | `text`      | `varchar(255)` utf8mb4, `utf8mb4_bin`     | `text`                | `nvarchar(255)` |
| `created_at`, `updated_at`                                  | `timestamptz` | `datetime`                                | `integer` (unix seconds) | `datetime2`  |

MySQL string columns use the binary collation `utf8mb4_bin`, so names compare case-sensitively like on the other
databases. SQL Server uses the database's default collation (usually case-insensitive).

## Typing your `Database`

```ts
import type { RbacDatabase } from '@anievo-id/rbac-evolution-kysely'

interface Database extends RbacDatabase {
  users: UsersTable
}
// with a prefix: interface Database extends RbacDatabase<'rbac_'> { ... }

const db = new Kysely<Database>({ dialect })
const roles = await db.selectFrom('roles').selectAll().execute()
```

Individual table interfaces are exported too: `PermissionsTable`, `RolesTable`, `RoleHasPermissionsTable`,
`ModelHasRolesTable`, `ModelHasPermissionsTable`. Your `Database` type does not have to include them for the adapter
to work.

## Usage

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { kyselyAdapter } from '@anievo-id/rbac-evolution-kysely'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }) }),
})

export const rbac = createRbac({ adapter: kyselyAdapter(db) })
// options: kyselyAdapter(db, { dialect: 'postgres', prefix: 'rbac_' })
```

```ts
await rbac.createPermission('edit articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

const user = rbac.for({ type: 'user', id: 1 })
await user.assignRole('writer')
await user.can('edit articles') // true
```

## Notes

- Role and permission ids are auto-increment integers returned as `number`. Subject ids returned by reverse lookups
  are strings. Ids that can't be integers are ignored (no row could match them).
- `attach*` calls are idempotent: `ON CONFLICT DO NOTHING` (PostgreSQL, SQLite), a no-op
  `ON DUPLICATE KEY UPDATE` (MySQL), `INSERT ... WHERE NOT EXISTS` with duplicate-key errors ignored (SQL Server).
- New ids come from `RETURNING` (PostgreSQL, SQLite ≥ 3.35), `OUTPUT` (SQL Server) or the driver's insert id (MySQL).
- Deletes run a few statements (links first, then the row) without a transaction. For atomic work, build a
  short-lived adapter on a transaction: `await db.transaction().execute(async (trx) => { kyselyAdapter(trx) /* ... */ })`.

## License

MIT
