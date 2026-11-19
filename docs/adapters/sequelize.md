# Sequelize adapter

`@anievo-id/rbac-evolution-sequelize` stores roles and permissions through your [Sequelize](https://sequelize.org)
6 instance. It ships migrations for sequelize-cli and Umzug that create the tables.

| Database | Sequelize `dialect` | Status |
| --- | --- | --- |
| PostgreSQL | `postgres` | Tested (PostgreSQL 16) |
| MySQL / MariaDB | `mysql`, `mariadb` | Tested (MySQL 8) |
| SQLite | `sqlite` | Tested |
| SQL Server | `mssql` | Tested (SQL Server 2022) |

Other dialects (`db2`, `snowflake`, `oracle`) throw when the adapter is created.

## Install

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-sequelize
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-sequelize
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-sequelize
```

:::

`sequelize` 6.1+ is a peer dependency. Sequelize 7 (`@sequelize/core`, still in alpha) isn't supported.

## Schema

The adapter uses the five tables described in the [adapters overview](/adapters/overview#the-five-tables), with the
same names, columns and indexes as the [Kysely adapter](/adapters/kysely). Tables created by the Kysely, TypeORM,
Drizzle or Prisma adapters work as they are.

### sequelize-cli

Add a migration file that exports `rbacMigration()`:

<!-- doc-test: skip -->
```js
// migrations/20261119000000-rbac.js
module.exports = require('@anievo-id/rbac-evolution-sequelize').rbacMigration()
```

```bash
npx sequelize-cli db:migrate
```

### Umzug

`rbacMigration()` also takes Umzug's `{ context }`, where `context` is the QueryInterface or the Sequelize instance:

```ts
import { Umzug, SequelizeStorage } from 'umzug'
import { rbacMigration } from '@anievo-id/rbac-evolution-sequelize'

const umzug = new Umzug({
  migrations: [{ name: '00-rbac', ...rbacMigration() }],
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
})

await umzug.up()
```

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `''` | Prefix for the five table names (`rbac_roles`, ...). Pass the same prefix to the adapter. |
| `expiry` | `false` | Also create the `expires_at` columns, for `sequelizeAdapter(sequelize, { expiry: true })`. |

`up` creates the tables that don't exist yet, and `down` drops them. For tables created without `expiry`, add a
migration with `rbacExpiryMigration()`: it adds the nullable `expires_at` columns, and its `down` removes them. See
[Temporary access](/basic-usage/temporary-access).

## Adapter

```ts
// src/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { sequelizeAdapter } from '@anievo-id/rbac-evolution-sequelize'
import { sequelize } from './db'

export const rbac = createRbac({ adapter: sequelizeAdapter(sequelize) })
```

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `''` | Table prefix, the same as in `rbacMigration()`. |
| `expiry` | `false` | Store an expiry per role assignment and direct permission. Needs the `expires_at` columns. |

## Transactions

Pass the transaction of `sequelize.transaction()`. The adapter then runs in it, so its writes commit or roll back with
yours:

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { sequelizeAdapter } from '@anievo-id/rbac-evolution-sequelize'

await sequelize.transaction(async (t) => {
  const user = await User.create({ email: 'ana@example.com' }, { transaction: t })
  const txRbac = createRbac({ adapter: sequelizeAdapter(t), cache: false })
  await txRbac.for({ type: 'user', id: user.id }).assignRole('writer')
})

// The main instance may hold cached lookups from before the transaction.
await rbac.forgetCachedPermissions()
```

::: tip
`cache: false` on the transaction instance keeps uncommitted data out of any cache. See [Cache](/advanced/cache).
:::

With the Sequelize instance itself, a delete (`deleteRole`, `deletePermission`, ...) runs its statements in a
transaction of its own, except on SQLite (like the Kysely adapter).

## How it works

The adapter is the [Kysely adapter](/adapters/kysely) with a small Kysely dialect that sends every query through
`sequelize.query()`, with bind parameters. Kysely is a dependency of this package; you don't need to set it up. So the
queries, the behaviour notes and the tests are the same as the Kysely adapter's:

- Role and permission ids are integers and come back as `number`. Reverse lookups return subject ids as strings.
- Every `attach*` skips links that already exist (`ON CONFLICT DO NOTHING`, `ON DUPLICATE KEY UPDATE`, or
  `WHERE NOT EXISTS` on SQL Server).
- Names and subject ids are compared exactly, whatever the column collation.

The same conformance suite as every other adapter runs on SQLite, PostgreSQL 16, MySQL 8 and SQL Server 2022 in CI.

Full API: [reference](/api/sequelize/)
