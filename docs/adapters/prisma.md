# Prisma adapter

`@anievo-id/rbac-evolution-prisma` stores roles and permissions through your existing Prisma client. It works with every relational connector Prisma supports. MongoDB is the exception.

## Install

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma
```

```bash [bun]
bun add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma
```

:::

Prisma itself (`@prisma/client` and the `prisma` CLI) is a peer dependency, and a Prisma project already has it installed. On Prisma 7, so is the [driver adapter](#prisma-7) for your database, such as `@prisma/adapter-pg`.

::: warning Prisma version
Use `@prisma/client` **5.12 or later: 5.x, 6 or 7**. Older versions don't support `createMany` on SQLite, and the adapter needs it. Prisma 7 sets the client up differently (a generator `output`, a driver adapter, `prisma.config.ts`); the adapter works the same on all three. See [Prisma 7](#prisma-7).
:::

## 1. Add the models to your schema

Copy these five models into `schema.prisma`. If your schema is split into a folder (`prismaSchemaFolder`), you can instead copy the file that ships with the package, `node_modules/@anievo-id/rbac-evolution-prisma/schema/rbac.prisma`, into that folder unchanged. It is the 1.1 schema in every 1.x release; the expiry variant ships separately as `schema/rbac-expiry.prisma` (see [Expiry (1.2)](#expiry-1-2)).

```prisma
model RbacPermission {
  id        Int      @id @default(autoincrement())
  name      String
  guardName String   @map("guard_name")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  roles    RbacRoleHasPermission[]
  subjects RbacModelHasPermission[]

  @@unique([name, guardName])
  @@map("permissions")
}

model RbacRole {
  id        Int      @id @default(autoincrement())
  teamId    String   @default("") @map("team_id")
  name      String
  guardName String   @map("guard_name")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  permissions RbacRoleHasPermission[]
  subjects    RbacModelHasRole[]

  @@unique([name, guardName, teamId])
  @@index([teamId])
  @@map("roles")
}

model RbacRoleHasPermission {
  permissionId Int @map("permission_id")
  roleId       Int @map("role_id")

  permission RbacPermission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  role       RbacRole       @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@index([permissionId])
  @@map("role_has_permissions")
}

model RbacModelHasRole {
  roleId      Int    @map("role_id")
  subjectType String @map("subject_type")
  subjectId   String @map("subject_id")
  teamId      String @default("") @map("team_id")

  role RbacRole @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([roleId, subjectType, subjectId, teamId])
  @@index([subjectType, subjectId, teamId])
  @@map("model_has_roles")
}

model RbacModelHasPermission {
  permissionId Int    @map("permission_id")
  subjectType  String @map("subject_type")
  subjectId    String @map("subject_id")
  teamId       String @default("") @map("team_id")

  permission RbacPermission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([permissionId, subjectType, subjectId, teamId])
  @@index([subjectType, subjectId, teamId])
  @@map("model_has_permissions")
}
```

::: tip What you may rename
- **Model names: keep them.** The adapter calls `prisma.rbacPermission`, `prisma.rbacRole`, `prisma.rbacRoleHasPermission`, `prisma.rbacModelHasRole` and `prisma.rbacModelHasPermission` by name.
- **Field names: keep them.** The adapter queries `name`, `guardName`, `teamId`, `subjectType` and the rest.
- **Table and column names: change them freely.** Edit the `@@map` and `@map` values, for example `@@map("rbac_roles")` if you already have a `roles` table.
:::

## 2. Create the tables

::: code-group

```bash [migrate]
npx prisma migrate dev --name rbac
```

```bash [db push]
npx prisma db push
```

:::

On Prisma 5 and 6, both commands also run `prisma generate`, so the new delegates show up on your client. Prisma 7
no longer generates from `migrate dev` or `db push`: run `npx prisma generate` afterwards.

## 3. Use it

::: code-group

```ts [Prisma 7]
// lib/rbac.ts
import { PrismaPg } from '@prisma/adapter-pg'
import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { PrismaClient } from '../generated/prisma/client' // your generator `output`

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
export const rbac = createRbac({ adapter: new PrismaAdapter(prisma) })
```

```ts [Prisma 5 / 6]
// lib/rbac.ts
import { PrismaClient } from '@prisma/client'
import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'

export const prisma = new PrismaClient()
export const rbac = createRbac({ adapter: new PrismaAdapter(prisma) })
```

:::

```ts
import { rbac } from './lib/rbac'

await rbac.createPermission('edit articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

const user = rbac.for({ type: 'user', id: currentUser.id })
await user.assignRole('writer')
await user.can('edit articles') // true
```

The adapter doesn't import `@prisma/client` itself. It accepts any object that has the five delegates and `$transaction`, which means it also works with:

- a custom generator `output` path (`import { PrismaClient } from './generated/client'`),
- both generators, `prisma-client-js` and Prisma 7's `prisma-client`, in ESM or CommonJS output,
- a schema with many other models,
- clients extended with `$extends(...)`.

## Prisma 7

Prisma 7 removed the Rust query engine and changed how a client is set up. The adapter needs no changes and no new
option: the [models](#_1-add-the-models-to-your-schema), the [options](#options) and the tables are the same as on
Prisma 5 and 6. What changes is your Prisma setup:

- **Generator.** Use `provider = "prisma-client"` with an `output` (now required), and import the client from that
  folder: `<output>/client`, not `@prisma/client`. The generated code is ESM; add `moduleFormat = "cjs"` for
  CommonJS. The older `prisma-client-js` generator still works on 7 and is deprecated; with a custom `output` it needs
  `@prisma/client-runtime-utils` installed.
- **Datasource URL.** The `url` moves out of `schema.prisma` into `prisma.config.ts`. The CLI no longer loads `.env`
  by itself, so load it there (`dotenv`).
- **Driver adapter.** `new PrismaClient()` without arguments is gone. Pass the driver adapter for your database:

  | Database | Package | Adapter |
  | --- | --- | --- |
  | PostgreSQL | `@prisma/adapter-pg` | `new PrismaPg({ connectionString })` |
  | MySQL / MariaDB | `@prisma/adapter-mariadb` | `new PrismaMariaDb({ host, user, password, database })` |
  | SQLite | `@prisma/adapter-better-sqlite3` | `new PrismaBetterSqlite3({ url: 'file:./dev.db' })` |
  | SQL Server | `@prisma/adapter-mssql` | `new PrismaMssql(config)` |

- **Generate yourself.** `prisma migrate dev` and `prisma db push` no longer run `prisma generate`.
- **MongoDB** is not supported by Prisma 7 (and was never supported by this adapter).

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ...the five rbac models
```

```ts
// prisma.config.ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
```

Then build the client with the adapter, as in the Prisma 7 tab of [3. Use it](#_3-use-it).

Things that behave the same on 7:

- **`skipDuplicates`** is still for PostgreSQL, CockroachDB, MySQL and MariaDB only. SQLite and SQL Server clients
  still don't accept it.
- **Unique violations** still come back as `P2002` from the driver adapters, so the default mode's
  read-and-retry works unchanged.
- **Interactive transactions.** On Prisma 7 a `tx` client has a `$transaction` method too (for nested transactions).
  The adapter recognizes a `tx` client by its missing `$connect` and runs its queries on `tx`, inside your
  transaction, as on 5 and 6.

### Teams

```ts
const rbac = createRbac({ adapter: new PrismaAdapter(prisma), teams: true })

await rbac.createRole('admin')                         // global role
await rbac.for(user, { team: org.id }).assignRole('admin')
```

See [Teams](/basic-usage/teams) for how global roles and team roles work together.

## Options

<!-- doc-test: skip -->
```ts
new PrismaAdapter(prisma, options?)
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `skipDuplicates` | `boolean` | `false` | Use `createMany({ skipDuplicates: true })` for every attach, so it runs as a single race-free `INSERT ... ON CONFLICT DO NOTHING` / `INSERT IGNORE`. Only supported on PostgreSQL, CockroachDB, MySQL and MariaDB. |
| `expiry` | `boolean` | `false` | Store an expiry per role assignment and direct permission, for [temporary access](/basic-usage/temporary-access). Needs the `expiresAt` fields, see [Expiry (1.2)](#expiry-1-2). |

With the default (`false`), each attach reads the links that already exist and inserts only the missing ones. If another request inserts the same link in the meantime (Prisma error `P2002`), the adapter reads again and retries. This mode works on every connector.

```ts
// PostgreSQL / MySQL / MariaDB / CockroachDB
const adapter = new PrismaAdapter(prisma, { skipDuplicates: true })
```

## Expiry (1.2)

[Temporary access](/basic-usage/temporary-access) stores when a role assignment or direct permission ends in an
`expires_at` column. It is **off by default**: without `{ expiry: true }` the adapter never reads or writes that
field, so a schema from 1.1 keeps working after the upgrade, unchanged. A schema that has the fields works without
the option too (new links get `NULL`).

To turn it on in an existing app:

1. Add one line to each of the two link models of the [models above](#_1-add-the-models-to-your-schema). With a schema
   folder, you can instead replace the copied `rbac.prisma` with the shipped `schema/rbac-expiry.prisma`, which is the
   same models plus these two lines:

   ```prisma
   model RbacModelHasRole {
     // ...the existing fields
     expiresAt   DateTime? @map("expires_at")
   }

   model RbacModelHasPermission {
     // ...the existing fields
     expiresAt    DateTime? @map("expires_at")
   }
   ```

2. Create a migration and apply it. It adds a nullable column to `model_has_roles` and `model_has_permissions`;
   existing rows get `NULL`, which means permanent:

   ```bash
   npx prisma migrate dev --name rbac_expiry
   ```

   The generated SQL is a plain `ALTER TABLE ... ADD COLUMN "expires_at" TIMESTAMP(3)` (PostgreSQL) or
   `DATETIME(3) NULL` (MySQL). Deploy it with `prisma migrate deploy` as usual.

3. Create the adapter with the option:

   ```ts
   const rbac = createRbac({ adapter: new PrismaAdapter(prisma, { expiry: true }) })

   await rbac.for(user).assignRole('on-call', { expiresAt: new Date(Date.now() + 8 * 3_600_000) })
   ```

Apply the migration before you deploy the client generated from the new schema: a client whose models have
`expiresAt` reads that column in every query on the two link tables, whatever the adapter option. A database that
has the column with an older client is fine, so rolling back the code is safe.

Without the option, an `expiresAt` throws `EXPIRY_NOT_SUPPORTED` and writes nothing.

## How values come back

| Value | Stored as | Returned as |
| --- | --- | --- |
| Role / permission `id` | autoincrement `Int` | `number`. Numeric strings like `'42'` are accepted as input. |
| Subject id | `subject_id` text | Reverse lookups return **strings**. `1` and `'1'` are the same subject. |
| `Role.teamId` | `team_id` text, `''` = global | `null` for global roles, otherwise a string (`'7'`) |

When the engine passes an id that isn't an integer to an attach method, the adapter throws a `TypeError` (`PrismaAdapter: invalid role id ...`). Lookups and detaches skip such ids instead.

## Database notes

| Database | Notes |
| --- | --- |
| **PostgreSQL / CockroachDB** | `String` maps to `text`, no changes needed. Turn on `skipDuplicates: true`. |
| **MySQL / MariaDB** | `String` maps to `VARCHAR(191)`, which keeps the composite keys under InnoDB's 3072-byte index limit with `utf8mb4`. Don't change these fields to `@db.Text`, because MySQL can't index a whole `TEXT` column. Turn on `skipDuplicates: true`. The columns use the database's default collation, which is usually case- and accent-insensitive. The adapter compares every row it reads exactly, so a subject `'ABC'` or `'abc '` never gets the roles of `'abc'`. The unique keys still follow the collation, though: `'Edit'` next to `'edit'`, or a role for `'ABC'` while `'abc'` holds it, is rejected or skipped. If your names or ids are case-sensitive, give the database or tables a binary collation without padding: `utf8mb4_0900_bin` (MySQL 8) or `utf8mb4_nopad_bin` (MariaDB). `utf8mb4_bin` still ignores trailing spaces. |
| **SQLite** | Keep the default `skipDuplicates: false`. The connector doesn't support it. |
| **SQL Server** | Keep the default `skipDuplicates: false`. The connector doesn't support it. |
| **MongoDB** | Not supported. The schema relies on autoincrement ids and composite primary keys. |

More things to know:

- **Deletes are transactional.** `deleteRole` and `deletePermission` remove the link rows and the row itself in one `$transaction`. Because of this, the `onDelete: Cascade` relations are only a safety net, and the adapter also works with `relationMode = "prisma"`.
- **Uniqueness.** The engine checks names before inserting, and the unique constraints enforce them. If two requests race to create the same name, the second one fails with Prisma's `P2002` error.
- **Interactive transactions.** On the root client, the adapter runs its multi-step deletes in one `$transaction([...])`. Given the client of `prisma.$transaction(async (tx) => ...)`, it runs them one after the other on `tx`, inside your transaction, so they commit or roll back with it.

::: tip Cache across instances
The default cache lives in process memory. If you run several app instances against one database, read [Cache: multiple processes](/advanced/cache#multiple-processes).
:::

## How it's tested

The adapter runs the shared conformance suite (`runAdapterTests` from `@anievo-id/rbac-evolution/testing`) against clients generated from the shipped `schema/rbac-expiry.prisma`, plus a client generated from the 1.1 `schema/rbac.prisma` without the option.

It runs on Prisma 7 (with the driver adapters: `better-sqlite3`, `pg` and `mariadb`, the `prisma-client` generator, and `prisma-client-js` for the 1.1 client) in every test run, and on Prisma 6 and 5.12 (the Rust engine, `prisma-client-js`) in the CI `peers` job:

| Database | When |
| --- | --- |
| SQLite | every test run |
| PostgreSQL 16 | when `PG_URL` is set (CI `databases` job) |
| MySQL 8 | when `MYSQL_URL` is set (CI `databases` job) |

PostgreSQL and MySQL are tested with both `skipDuplicates: false` and `skipDuplicates: true`. Without the variables, those suites show up as skipped. To run them locally, point the variables at a server you can create databases on; the schema is pushed into a dedicated `rbac_evolution_prisma_test` database, which is reset on every run:

```bash
PG_URL=postgresql://postgres:postgres@localhost:5432/postgres \
MYSQL_URL=mysql://root:root@127.0.0.1:3306/mysql \
pnpm --filter @anievo-id/rbac-evolution-prisma test
```

The other connectors (MariaDB, SQL Server, CockroachDB) use the same models but aren't covered by CI.

## Seeding

Seed scripts can run more than once if you use the `findOrCreate*` helpers:

```ts
// prisma/seed.ts
import { rbac, prisma } from '../lib/rbac'

const permissions = ['view articles', 'edit articles', 'delete articles']
for (const name of permissions) await rbac.findOrCreatePermission(name)

await rbac.findOrCreateRole('writer')
await rbac.role('writer').syncPermissions('view articles', 'edit articles')

await rbac.findOrCreateRole('admin')
await rbac.role('admin').syncPermissions(permissions)

await prisma.$disconnect()
```

Full API: [reference](/api/prisma/)
