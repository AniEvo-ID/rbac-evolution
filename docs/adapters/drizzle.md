# Drizzle adapter

`@anievo-id/rbac-evolution-drizzle` stores roles and permissions through [Drizzle ORM](https://orm.drizzle.team). It ships the table definitions and an adapter factory for each supported dialect.

| Dialect | Entry point | Drivers |
| --- | --- | --- |
| PostgreSQL | `@anievo-id/rbac-evolution-drizzle/pg` | node-postgres, postgres.js, Neon, Vercel Postgres, PGlite, ... |
| SQLite | `@anievo-id/rbac-evolution-drizzle/sqlite` | libsql / Turso, better-sqlite3, Bun SQLite, Cloudflare D1, ... |
| MySQL | — | Not supported yet |

The package root (`@anievo-id/rbac-evolution-drizzle`) re-exports everything from both entry points.

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

`drizzle-orm` 0.36 or later is a peer dependency. Install your database driver as usual.

## Schema

The tables are built by a factory function, `pgRbacSchema()` or `sqliteRbacSchema()`. Each returns the five tables described in the [adapters overview](/adapters/overview#the-five-tables):

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

Both files use `CREATE ... IF NOT EXISTS`, so running them twice is harmless. For example, with `psql`:

```bash
psql "$DATABASE_URL" -f node_modules/@anievo-id/rbac-evolution-drizzle/sql/pg.sql
```

If you use a prefix, add it to every table, constraint and index name in the file.

### Column types

| Column | PostgreSQL | SQLite |
| --- | --- | --- |
| `id` | `serial` | `integer PRIMARY KEY AUTOINCREMENT` |
| `name`, `guard_name`, `subject_type`, `subject_id`, `team_id` | `text` | `text` |
| `created_at`, `updated_at` | `timestamp with time zone DEFAULT now()` | `integer` unix seconds (Drizzle `mode: 'timestamp'` → `Date`) |

`team_id` is `NOT NULL DEFAULT ''`, and `''` means global. See [storage conventions](/adapters/overview#storage-conventions).

## Adapter

Each dialect has a factory function that takes a Drizzle database instance and, optionally, the schema object:

```ts
drizzlePgAdapter(db, schema?: PgRbacSchema): RbacAdapter
drizzleSqliteAdapter(db, schema?: SqliteRbacSchema): RbacAdapter
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
| `PgRbacSchema`, `SqliteRbacSchema`, `RbacSchemaOptions` | `/pg`, `/sqlite` | types |
| `DrizzleRbacAdapter`, `RbacTables`, `RbacTableNames` | package root | class / types |

`RbacSchemaOptions` has one field, `prefix?: string` (default `''`).

## Behaviour notes

- **Ids.** Role and permission ids are integers and come back as `number`. Reverse lookups (`getSubjectIdsWithRoles`, `getSubjectIdsWithPermissions`) return subject ids as **strings**.
- **Non-integer ids are ignored.** If the engine passes an id that can't be an integer, the adapter drops it instead of throwing, because no row could match it anyway.
- **Idempotent attach.** Every `attach*` method is a single `INSERT ... ON CONFLICT DO NOTHING`, so it is safe when requests race.
- **Link cleanup.** `deleteRole` and `deletePermission` delete the link rows themselves before deleting the row. This works even when SQLite foreign keys are off (the default). The `ON DELETE CASCADE` clauses take effect on SQLite only after `PRAGMA foreign_keys = ON` for each connection.
- **Timestamps.** The adapter never writes or returns `created_at` / `updated_at`. They keep their default values.

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
