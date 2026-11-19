# TypeORM adapter

`@anievo-id/rbac-evolution-typeorm` stores roles and permissions through your [TypeORM](https://typeorm.io)
`DataSource`. It runs on TypeORM 0.3.20+ and 1.x, and ships migration classes that create the tables.

| Database | TypeORM `type` | Status |
| --- | --- | --- |
| PostgreSQL | `postgres` (also `aurora-postgres`, `cockroachdb`) | Tested (PostgreSQL 16) |
| MySQL / MariaDB | `mysql`, `mariadb` (also `aurora-mysql`) | Tested (MySQL 8) |
| SQLite | `better-sqlite3` (also `sqlite`, `sqljs`, `capacitor`, `expo`, ...) | Tested |
| SQL Server | `mssql` | Tested (SQL Server 2022) |

Other drivers (MongoDB, Oracle, SAP HANA, Spanner) throw when the adapter is created.

## Install

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-typeorm
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-typeorm
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-typeorm
```

:::

`typeorm` 0.3.20+ or 1.x is a peer dependency. Keep your database driver as it is.

## Schema

The adapter uses the five tables described in the [adapters overview](/adapters/overview#the-five-tables), with the
same names, columns and indexes as the [Kysely adapter](/adapters/kysely). Tables created by the Kysely, Drizzle or
Prisma adapters work as they are.

Add `rbacMigration()` to the DataSource's `migrations` and run them as usual:

```ts
// src/data-source.ts
import { DataSource } from 'typeorm'
import { rbacMigration } from '@anievo-id/rbac-evolution-typeorm'

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User],
  migrations: [rbacMigration(), 'dist/migrations/*.js'],
})
```

```bash
npx typeorm migration:run -d dist/data-source.js
```

`rbacMigration()` returns a migration class. Its `up` creates the tables that don't exist yet, in TypeORM's migration
transaction, and its `down` drops them.

| Option | Default | Description |
| --- | --- | --- |
| `name` | `'RbacEvolutionTables1763510400000'` | The migration's name. TypeORM needs a 13-digit timestamp at the end, and runs any migration whose name isn't in its migrations table yet. Don't rename it once it has run. |
| `prefix` | `''` | Prefix for the five table names (`rbac_roles`, ...). Pass the same prefix to the adapter. |
| `expiry` | `false` | Also create the `expires_at` columns, for `typeormAdapter(dataSource, { expiry: true })`. |

The rbac tables have no entities. `migration:generate` and `synchronize` leave tables without entities alone, so they
never try to change or drop them.

### Expiry on existing tables

For tables created without `expiry`, add `rbacExpiryMigration()` after `rbacMigration()`. It adds the nullable
`expires_at` columns, and its `down` removes them:

<!-- doc-test: skip -->
```ts
migrations: [rbacMigration(), rbacExpiryMigration(), 'dist/migrations/*.js'],
```

Then pass `{ expiry: true }` to the adapter. See [Temporary access](/basic-usage/temporary-access).

## Adapter

```ts
// src/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { typeormAdapter } from '@anievo-id/rbac-evolution-typeorm'
import { dataSource } from './data-source'

export const rbac = createRbac({ adapter: typeormAdapter(dataSource) })
```

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `''` | Table prefix, the same as in `rbacMigration()`. |
| `expiry` | `false` | Store an expiry per role assignment and direct permission. Needs the `expires_at` columns. |

Create the adapter after `dataSource.initialize()`, or before: it only reads the DataSource's `options.type` up front,
and runs its first query on the first check.

## Transactions

Pass the `EntityManager` of `dataSource.transaction()`. The adapter then runs on that transaction's query runner,
so its writes commit or roll back with yours:

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { typeormAdapter } from '@anievo-id/rbac-evolution-typeorm'

await dataSource.transaction(async (manager) => {
  const user = await manager.save(User, { email: 'ana@example.com' })
  const txRbac = createRbac({ adapter: typeormAdapter(manager), cache: false })
  await txRbac.for({ type: 'user', id: user.id }).assignRole('writer')
})

// The main instance may hold cached lookups from before the transaction.
await rbac.forgetCachedPermissions()
```

::: tip
`cache: false` on the transaction instance keeps uncommitted data out of any cache. See [Cache](/advanced/cache).
:::

With the DataSource itself, a delete (`deleteRole`, `deletePermission`, ...) runs its statements in a transaction of
its own, except on SQLite (like the Kysely adapter).

## NestJS

Inject the `DataSource` that `TypeOrmModule` provides:

```ts
// rbac.module.ts
import { Module } from '@nestjs/common'
import { RbacModule } from '@anievo-id/rbac-evolution-nestjs'
import { createRbac } from '@anievo-id/rbac-evolution'
import { typeormAdapter } from '@anievo-id/rbac-evolution-typeorm'
import { DataSource } from 'typeorm'

@Module({
  imports: [
    RbacModule.forRootAsync({
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => ({
        rbac: createRbac({ adapter: typeormAdapter(dataSource) }),
        getSubject: (ctx) => {
          const user = ctx.switchToHttp().getRequest().user
          return user ? { type: 'user', id: user.id } : null
        },
      }),
    }),
  ],
})
export class AppRbacModule {}
```

See [NestJS](/frameworks/nestjs) for the guards and decorators.

## How it works

The adapter is the [Kysely adapter](/adapters/kysely) with a small Kysely dialect that sends every query through
TypeORM: a query runner of your DataSource, or the one of your `EntityManager`. Kysely is a dependency of this
package; you don't need to set it up. So the queries, the behaviour notes and the tests are the same as the Kysely
adapter's:

- Role and permission ids are integers and come back as `number`. Reverse lookups return subject ids as strings.
- Every `attach*` skips links that already exist (`ON CONFLICT DO NOTHING`, `ON DUPLICATE KEY UPDATE`, or
  `WHERE NOT EXISTS` on SQL Server).
- Names and subject ids are compared exactly, whatever the column collation.

The same conformance suite as every other adapter runs on SQLite, PostgreSQL 16, MySQL 8 and SQL Server 2022 in CI,
on TypeORM 1.x and 0.3.20.

Full API: [reference](/api/typeorm/)
