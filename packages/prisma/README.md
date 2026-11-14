# @anievo-id/rbac-evolution-prisma

📖 **[Documentation](https://app.anievo.id/rbac-evolution/adapters/prisma)**

[Prisma](https://www.prisma.io) storage adapter for [rbac-evolution](https://github.com/AniEvo-ID/rbac-evolution), a TypeScript port of spatie/laravel-permission.

It stores roles and permissions in the same five tables spatie uses: `permissions`, `roles`, `role_has_permissions`, `model_has_roles` and `model_has_permissions`.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma
# you already have these in a Prisma project:
npm i @prisma/client && npm i -D prisma
```

Requires `@prisma/client` 5.12 or later. Earlier versions do not support `createMany` on SQLite.

## 1. Add the models to your schema

Copy the models below into your `schema.prisma`. If you use a multi-file schema folder, you can copy the shipped file `node_modules/@anievo-id/rbac-evolution-prisma/schema/rbac.prisma` in as-is. Keep the model names, because the adapter talks to `prisma.rbacPermission`, `prisma.rbacRole` and the other delegates by name. Table and column names (`@@map` / `@map`) can be changed.

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

Then create the tables:

```bash
npx prisma migrate dev --name rbac   # or: npx prisma db push
```

## 2. Use it

```ts
import { PrismaClient } from '@prisma/client'
import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'

const prisma = new PrismaClient()
export const rbac = createRbac({ adapter: new PrismaAdapter(prisma) })

await rbac.createPermission('edit articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

const user = rbac.for({ type: 'user', id: currentUser.id })
await user.assignRole('writer')
await user.can('edit articles') // true
```

The adapter does not import your generated client. It accepts any object with the five delegates plus `$transaction`, so it works with a custom generator `output`, extra models and `$extends(...)`-extended clients.

### Teams

```ts
const rbac = createRbac({ adapter: new PrismaAdapter(prisma), teams: true })
await rbac.for(user, { team: org.id }).assignRole('admin')
```

## How data is stored

| Concept            | Column(s)                         | Notes |
| ------------------ | --------------------------------- | ----- |
| Role / permission id | `id` autoincrement `Int`        | Returned as a `number`. Numeric strings (`'42'`) are accepted as input. |
| Subject            | `subject_type` + `subject_id` (text) | Any id type works: number, UUID or cuid. `1` and `'1'` are the same subject. Reverse lookups (`getSubjectIdsWithRoles` / `...WithPermissions`) return ids as **strings**. |
| Team               | `team_id` text, NOT NULL          | `''` (empty string) means global / no team. This keeps composite primary keys and unique constraints working, because `NULL`s never collide. `Role.teamId` comes back as `null` for global roles, otherwise as a string (`'7'`). Do not use `''` as a real team id. |

Deleting a role or permission removes its links in the same transaction, so the `onDelete: Cascade` relations are a safety net and are not required. This means it also works with `relationMode = "prisma"`.

## Database notes

- **PostgreSQL / CockroachDB / MySQL / MariaDB**: pass `{ skipDuplicates: true }` so each attach is a single race-free `INSERT ... ON CONFLICT DO NOTHING` / `INSERT IGNORE`:

  ```ts
  new PrismaAdapter(prisma, { skipDuplicates: true })
  ```

  The default (`false`) works on every connector. It reads the existing links, inserts only the missing ones, and retries if a concurrent request inserted the same link first.
- **SQLite / SQL Server**: keep the default. These connectors do not support `skipDuplicates`.
- **MySQL**: `String` maps to `VARCHAR(191)`, so the composite keys stay under InnoDB's 3072-byte index limit with `utf8mb4`. Do not widen these columns to `@db.Text`, because MySQL cannot index a full `TEXT` column.
- **PostgreSQL**: `String` maps to `text`, which needs no changes.
- **MongoDB** is not supported: the schema relies on autoincrement ids and composite primary keys.
- Name uniqueness is checked by the engine and enforced by the unique constraints. A duplicate that slips through a race raises Prisma's `P2002` error.

## Development

```bash
pnpm --filter @anievo-id/rbac-evolution-prisma test
```

`node test/prepare.mjs` builds a SQLite test schema from `schema/rbac.prisma`. It generates the client into `test/generated` and recreates `test/.tmp/test.db`. The script then runs the shared `runAdapterTests` conformance suite plus the adapter-specific tests.

## License

MIT
