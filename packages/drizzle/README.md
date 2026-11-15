# @anievo-id/rbac-evolution-drizzle

📖 **[Documentation](https://creation.anievo.id/rbac-evolution/adapters/drizzle)**

[Drizzle ORM](https://orm.drizzle.team) storage adapter for [rbac-evolution](https://github.com/AniEvo-ID/rbac-evolution) — roles & permissions for JS/TS, inspired by spatie/laravel-permission.

Supported dialects:

| Dialect    | Entry point                                   | Drivers                                                         |
| ---------- | --------------------------------------------- | --------------------------------------------------------------- |
| PostgreSQL | `@anievo-id/rbac-evolution-drizzle/pg`        | node-postgres, postgres.js, Neon, Vercel Postgres, PGlite, ...   |
| SQLite     | `@anievo-id/rbac-evolution-drizzle/sqlite`    | libsql / Turso, better-sqlite3, Bun SQLite, Cloudflare D1, ...   |
| MySQL      | `@anievo-id/rbac-evolution-drizzle/mysql`     | mysql2, PlanetScale, TiDB Serverless, ... (MySQL 8, MariaDB)     |

Everything is also re-exported from the package root.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-drizzle drizzle-orm
```

## Tables

The schema mirrors spatie/laravel-permission:

| Table                   | Columns                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `permissions`           | `id` (auto-increment), `name`, `guard_name`, `created_at`, `updated_at` — unique `(name, guard_name)` |
| `roles`                 | `id` (auto-increment), `name`, `guard_name`, `team_id`, `created_at`, `updated_at` — unique `(name, guard_name, team_id)` |
| `role_has_permissions`  | `role_id`, `permission_id` — composite PK                                                   |
| `model_has_roles`       | `role_id`, `subject_type`, `subject_id`, `team_id` — composite PK                           |
| `model_has_permissions` | `permission_id`, `subject_type`, `subject_id`, `team_id` — composite PK                     |

- `subject_type` / `subject_id` are `text` (MySQL: `varchar(191)`), so subjects may have numeric **or** string (UUID, cuid, ...) ids.
- `team_id` is `text NOT NULL` (MySQL: `varchar(191)`); the empty string `''` means "global / no team" (this keeps composite primary keys
  possible). The adapter converts it back: `Role.teamId` is `null` for global roles and a **string** otherwise
  (`teamId: 1` is returned as `'1'`). Don't use `''` as a real team id.
- `created_at` / `updated_at` (Drizzle: `createdAt` / `updatedAt`) are NOT NULL and default to the current time:
  `timestamp with time zone DEFAULT now()` on PostgreSQL, unix seconds (`integer`, `mode: 'timestamp'` → `Date`) on
  SQLite, `timestamp DEFAULT CURRENT_TIMESTAMP` on MySQL. The adapter never returns or updates them (roles/permissions are not renamed through the engine).
- MySQL string columns are bounded `varchar`s (`name` / `guard_name` 255, the others 191) so every key fits InnoDB's
  3072-byte index limit, with `COLLATE utf8mb4_bin` so comparisons are case-sensitive like on PostgreSQL / SQLite.
- Link tables reference `roles` / `permissions` with `ON DELETE CASCADE`. The adapter also deletes links itself, so it
  works when foreign keys are disabled (SQLite's default).

## Schema setup

### With drizzle-kit

Add the tables to your Drizzle schema file. drizzle-kit only discovers **top-level exports**, so destructure them:

```ts
// db/schema.ts — PostgreSQL
import { pgRbacSchema } from '@anievo-id/rbac-evolution-drizzle/pg'

export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = pgRbacSchema()

// ...your own tables
```

```ts
// db/schema.ts — SQLite
import { sqliteRbacSchema } from '@anievo-id/rbac-evolution-drizzle/sqlite'

export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = sqliteRbacSchema()
```

```ts
// db/schema.ts — MySQL
import { mysqlRbacSchema } from '@anievo-id/rbac-evolution-drizzle/mysql'

export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = mysqlRbacSchema()
```

Then run `npx drizzle-kit generate` / `npx drizzle-kit migrate` (or `push`) as usual.

**Table prefix** — avoid clashes with existing `roles` / `permissions` tables:

```ts
export const rbacTables = pgRbacSchema({ prefix: 'rbac_' }) // rbac_permissions, rbac_roles, ...
export const {
  permissions: rbacPermissions,
  roles: rbacRoles,
  roleHasPermissions: rbacRoleHasPermissions,
  modelHasRoles: rbacModelHasRoles,
  modelHasPermissions: rbacModelHasPermissions,
} = rbacTables
```

Pass the **same** schema object to the adapter (see below) when you use a prefix.

### Without drizzle-kit (plain SQL)

Ready-to-run DDL ships with the package:

- `node_modules/@anievo-id/rbac-evolution-drizzle/sql/pg.sql`
- `node_modules/@anievo-id/rbac-evolution-drizzle/sql/sqlite.sql`
- `node_modules/@anievo-id/rbac-evolution-drizzle/sql/mysql.sql`

All use `CREATE ... IF NOT EXISTS`. For a prefix, prefix every table, constraint and index name in the file.

## Usage

### PostgreSQL

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzlePgAdapter } from '@anievo-id/rbac-evolution-drizzle/pg'
import { drizzle } from 'drizzle-orm/node-postgres'

const db = drizzle(process.env.DATABASE_URL!)

export const rbac = createRbac({ adapter: drizzlePgAdapter(db) })
```

### SQLite

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzleSqliteAdapter } from '@anievo-id/rbac-evolution-drizzle/sqlite'
import { drizzle } from 'drizzle-orm/libsql'

const db = drizzle({ connection: { url: 'file:local.db' } })

export const rbac = createRbac({ adapter: drizzleSqliteAdapter(db) })
```

### MySQL

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzleMysqlAdapter } from '@anievo-id/rbac-evolution-drizzle/mysql'
import { drizzle } from 'drizzle-orm/mysql2'

const db = drizzle(process.env.DATABASE_URL!)

export const rbac = createRbac({ adapter: drizzleMysqlAdapter(db) })
```

### With a prefix / custom schema object

```ts
import { rbacTables } from './db/schema' // pgRbacSchema({ prefix: 'rbac_' })

const rbac = createRbac({ adapter: drizzlePgAdapter(db, rbacTables) })
```

### Then

```ts
await rbac.createPermission('edit articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

const user = rbac.for({ type: 'user', id: 1 })
await user.assignRole('writer')
await user.can('edit articles') // true
```

## Notes

- Role and permission ids are auto-increment integers and are returned as `number`.
  Subject ids returned by reverse lookups (`getSubjectIdsWithRoles` / `getSubjectIdsWithPermissions`) are strings.
- `attach*` calls are idempotent (`INSERT ... ON CONFLICT DO NOTHING`; on MySQL a no-op `ON DUPLICATE KEY UPDATE`).
- MySQL has no `INSERT ... RETURNING`; `createPermission` / `createRole` use Drizzle's `$returningId()`.
- Deletes of roles/permissions run a few sequential statements (links first, then the row); they are not wrapped in a
  transaction. For atomic work, build a short-lived adapter on a transaction:
  `await db.transaction(async (tx) => { const adapter = drizzlePgAdapter(tx); /* ... */ })`.

## License

MIT
