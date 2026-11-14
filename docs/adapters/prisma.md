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

Prisma itself (`@prisma/client` and the `prisma` CLI) is a peer dependency, and a Prisma project already has it installed.

::: warning Prisma version
Use `@prisma/client` **5.12 or later**. Older versions don't support `createMany` on SQLite, and the adapter needs it.
:::

## 1. Add the models to your schema

Copy these five models into `schema.prisma`. If your schema is split into a folder (`prismaSchemaFolder`), you can instead copy the file that ships with the package, `node_modules/@anievo-id/rbac-evolution-prisma/schema/rbac.prisma`, into that folder unchanged.

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

Both commands also run `prisma generate`, so the new delegates show up on your client.

## 3. Use it

```ts
// lib/rbac.ts
import { PrismaClient } from '@prisma/client'
import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'

export const prisma = new PrismaClient()
export const rbac = createRbac({ adapter: new PrismaAdapter(prisma) })
```

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
- a schema with many other models,
- clients extended with `$extends(...)`.

### Teams

```ts
const rbac = createRbac({ adapter: new PrismaAdapter(prisma), teams: true })

await rbac.createRole('admin')                         // global role
await rbac.for(user, { team: org.id }).assignRole('admin')
```

See [Teams](/basic-usage/teams) for how global roles and team roles work together.

## Options

```ts
new PrismaAdapter(prisma, options?)
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `skipDuplicates` | `boolean` | `false` | Use `createMany({ skipDuplicates: true })` for every attach, so it runs as a single race-free `INSERT ... ON CONFLICT DO NOTHING` / `INSERT IGNORE`. Only supported on PostgreSQL, CockroachDB, MySQL and MariaDB. |

With the default (`false`), each attach reads the links that already exist and inserts only the missing ones. If another request inserts the same link in the meantime (Prisma error `P2002`), the adapter reads again and retries. This mode works on every connector.

```ts
// PostgreSQL / MySQL / MariaDB / CockroachDB
const adapter = new PrismaAdapter(prisma, { skipDuplicates: true })
```

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
| **MySQL / MariaDB** | `String` maps to `VARCHAR(191)`, which keeps the composite keys under InnoDB's 3072-byte index limit with `utf8mb4`. Don't change these fields to `@db.Text`, because MySQL can't index a whole `TEXT` column. Turn on `skipDuplicates: true`. The columns use the database's default collation, which is usually case-insensitive: `'Edit'` and `'edit'` are then the same name and `'aBc'` and `'ABC'` the same subject id. If your ids are case-sensitive, give the database or tables a binary collation such as `utf8mb4_bin`. |
| **SQLite** | Keep the default `skipDuplicates: false`. The connector doesn't support it. |
| **SQL Server** | Keep the default `skipDuplicates: false`. The connector doesn't support it. |
| **MongoDB** | Not supported. The schema relies on autoincrement ids and composite primary keys. |

More things to know:

- **Deletes are transactional.** `deleteRole` and `deletePermission` remove the link rows and the row itself in one `$transaction`. Because of this, the `onDelete: Cascade` relations are only a safety net, and the adapter also works with `relationMode = "prisma"`.
- **Uniqueness.** The engine checks names before inserting, and the unique constraints enforce them. If two requests race to create the same name, the second one fails with Prisma's `P2002` error.
- **Interactive transactions.** The adapter calls `$transaction([...])` with an array, and the client you get inside `prisma.$transaction(async (tx) => ...)` has no `$transaction` method. Build the adapter on the root client.

::: tip Cache across instances
The default cache lives in process memory. If you run several app instances against one database, read [Cache: multiple processes](/advanced/cache#multiple-processes).
:::

## How it's tested

The adapter runs the shared conformance suite (`runAdapterTests` from `@anievo-id/rbac-evolution/testing`) against clients generated from the shipped `schema/rbac.prisma`:

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
