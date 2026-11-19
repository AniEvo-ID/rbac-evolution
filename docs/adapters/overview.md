# Adapters

The RBAC Evolution engine does not talk to a database itself. Every read and write goes through an **adapter**: an object that implements the `RbacAdapter` interface from `@anievo-id/rbac-evolution`. You pass it to `createRbac()` once, and the rest of your code only uses the engine API.

<!-- doc-test: skip -->
```ts
import { createRbac } from '@anievo-id/rbac-evolution'

const rbac = createRbac({ adapter: /* any RbacAdapter */ })
```

The engine handles the logic: name validation, guards, teams, wildcards, caching and events. The adapter only stores and loads rows. Because of this split, switching from the in-memory adapter to a real database doesn't change any of your permission checks.

## Available adapters

| Adapter | Package | Import | Databases |
| --- | --- | --- | --- |
| [`MemoryAdapter`](/adapters/memory) | `@anievo-id/rbac-evolution` | `import { MemoryAdapter } from '@anievo-id/rbac-evolution'` | None (in process) |
| [`PrismaAdapter`](/adapters/prisma) | `@anievo-id/rbac-evolution-prisma` | `import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'` | PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, CockroachDB |
| [`drizzlePgAdapter`](/adapters/drizzle) | `@anievo-id/rbac-evolution-drizzle` | `import { drizzlePgAdapter } from '@anievo-id/rbac-evolution-drizzle/pg'` | PostgreSQL (node-postgres, postgres.js, Neon, PGlite, ...) |
| [`drizzleSqliteAdapter`](/adapters/drizzle) | `@anievo-id/rbac-evolution-drizzle` | `import { drizzleSqliteAdapter } from '@anievo-id/rbac-evolution-drizzle/sqlite'` | SQLite (libsql/Turso, better-sqlite3, D1, Bun, ...) |
| [`drizzleMysqlAdapter`](/adapters/drizzle) | `@anievo-id/rbac-evolution-drizzle` | `import { drizzleMysqlAdapter } from '@anievo-id/rbac-evolution-drizzle/mysql'` | MySQL 8, MariaDB (mysql2, PlanetScale, ...) |
| [`kyselyAdapter`](/adapters/kysely) | `@anievo-id/rbac-evolution-kysely` | `import { kyselyAdapter } from '@anievo-id/rbac-evolution-kysely'` | PostgreSQL, MySQL, SQLite, SQL Server |
| [`typeormAdapter`](/adapters/typeorm) | `@anievo-id/rbac-evolution-typeorm` | `import { typeormAdapter } from '@anievo-id/rbac-evolution-typeorm'` | PostgreSQL, MySQL, SQLite, SQL Server |
| [`kyselyAdapter`](/adapters/mikro-orm) on MikroORM 7 | `@anievo-id/rbac-evolution-kysely` | `kyselyAdapter(orm.em.getKysely())` | PostgreSQL, MySQL, SQLite, SQL Server |
| [`sequelizeAdapter`](/adapters/sequelize) | `@anievo-id/rbac-evolution-sequelize` | `import { sequelizeAdapter } from '@anievo-id/rbac-evolution-sequelize'` | PostgreSQL, MySQL, SQLite, SQL Server |
| [`mongooseAdapter`](/adapters/mongoose) | `@anievo-id/rbac-evolution-mongoose` | `import { mongooseAdapter } from '@anievo-id/rbac-evolution-mongoose'` | MongoDB |
| [Your own](/adapters/custom) | — | `implements RbacAdapter` | Anything |

::: tip Which one should I pick?
- Already using Prisma, Drizzle, Kysely, TypeORM, Sequelize, MikroORM 7 or Mongoose? Use the matching adapter.
- Writing tests, a prototype, or an app whose roles never change at runtime? Use `MemoryAdapter`.
- Using another ORM or database (a REST API, a document store)? [Write a custom adapter](/adapters/custom) and check it with the shared conformance tests.
:::

## The five tables

The SQL adapters use the same five-table layout as spatie/laravel-permission, so anyone who knows that package will recognise the schema right away.

| Table | Holds | Key columns |
| --- | --- | --- |
| `permissions` | One row per permission and guard | `id`, `name`, `guard_name`. Unique on `(name, guard_name)` |
| `roles` | One row per role, guard and team | `id`, `name`, `guard_name`, `team_id`. Unique on `(name, guard_name, team_id)` |
| `role_has_permissions` | Which permissions a role grants | `role_id`, `permission_id` |
| `model_has_roles` | Which roles a subject holds | `role_id`, `subject_type`, `subject_id`, `team_id` |
| `model_has_permissions` | Direct permissions of a subject | `permission_id`, `subject_type`, `subject_id`, `team_id` |

The three link tables use composite primary keys, so each link exists only once. Link rows reference `roles` and `permissions` with `ON DELETE CASCADE`, but the adapters also delete the links themselves before they delete a role or permission. Cleanup still works when foreign keys are off (SQLite's default) or when Prisma runs with `relationMode = "prisma"`.

## Storage conventions

The SQL adapters (Prisma, Drizzle, Kysely, TypeORM, Sequelize) follow the same conventions, so their data looks the same in any of them.

### Integer ids for roles and permissions

`permissions.id` and `roles.id` are auto-increment integers. The adapters return them as `number`. Numeric strings such as `'42'` are also accepted wherever the engine passes an id.

### Subjects as `subject_type` + `subject_id` text

A [subject](/basic-usage/basic-usage) is any `{ type, id }` pair: a user, an API client, a service account. Laravel calls the same columns `model_type` and `model_id`. Both columns are text (`text`, or a bounded `varchar` on MySQL, which can't index a whole `TEXT` column):

- Any primary key works: auto-increment numbers, UUIDs, cuids, ObjectId strings.
- `{ type: 'user', id: 1 }` and `{ type: 'user', id: '1' }` are the same subject.
- Reverse lookups ([`subjectsWithRole` / `subjectsWithPermission`](/advanced/querying-subjects)) return subject ids as **strings** in the SQL adapters, because that is how they are stored.

### `team_id = ''` means global

With [teams](/basic-usage/teams) enabled, roles and links can belong to a team. `team_id` is a `NOT NULL` text column, and the empty string `''` stands for "no team" (global).

A `NULL` would be simpler, but `NULL`s never compare equal. They would break the composite primary keys and the `(name, guard_name, team_id)` unique index, and the same global role could be inserted twice. The adapters convert the value both ways:

| Engine value (`TeamId`) | Stored `team_id` | Returned as `Role.teamId` |
| --- | --- | --- |
| `null` (global) | `''` | `null` |
| `42` | `'42'` | `'42'` (a string) |
| `'acme'` | `'acme'` | `'acme'` |

::: warning
Never use `''` as a real team id. It is reserved for global data.
:::

### Timestamps

`permissions` and `roles` have `created_at` and `updated_at` columns, which default to the current time. The link tables have no timestamps.

| Adapter | Column type |
| --- | --- |
| Prisma | `DateTime` (`updatedAt` uses `@updatedAt`) |
| Drizzle, PostgreSQL | `timestamp with time zone DEFAULT now()` |
| Drizzle, SQLite | `integer` unix seconds, exposed as `Date` by Drizzle (`mode: 'timestamp'`) |
| Drizzle, MySQL | `timestamp DEFAULT CURRENT_TIMESTAMP` |

The engine never reads these columns. They are there for auditing and for your own admin screens.

### Which databases are tested

Every SQL adapter runs the shared [conformance suite](/adapters/custom) (`runAdapterTests`) in CI:

| Adapter | Always (embedded, every CI run and locally) | Real servers (CI `databases` job) |
| --- | --- | --- |
| Prisma | SQLite | PostgreSQL 16, MySQL 8 |
| Drizzle | PostgreSQL via PGlite, SQLite via libsql | PostgreSQL 16 (node-postgres), MySQL 8 (mysql2) |

The real-server suites run when `PG_URL` / `MYSQL_URL` are set and are reported as skipped otherwise.

## What the engine checks

Adapters stay small because the engine does most of the validation before it calls them:

- **Name uniqueness.** `createPermission` and `createRole` look for an existing row first and throw `PermissionAlreadyExists` or `RoleAlreadyExists`. The unique indexes in the SQL schemas back this up when two requests race.
- **Existence and guards.** Names are resolved to rows, and unknown names throw `RoleDoesNotExist` or `PermissionDoesNotExist` before the adapter writes anything. See [Errors](/advanced/errors).
- **Caching.** Each subject's resolved roles and permissions are cached by the engine, not by the adapter. See [Cache](/advanced/cache).

## Next steps

- [Prisma adapter](/adapters/prisma)
- [Drizzle adapter](/adapters/drizzle)
- [Memory adapter](/adapters/memory)
- [Writing a custom adapter](/adapters/custom)
