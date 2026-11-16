# @anievo-id/rbac-evolution-prisma

[Prisma](https://www.prisma.io) storage adapter for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution). It
uses the same five tables as spatie/laravel-permission.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma @prisma/client
npm i -D prisma
```

Requires `@prisma/client` 5.12 or later: 5.x, 6 or 7. On Prisma 7, also install the driver adapter for your
database (`@prisma/adapter-pg`, `@prisma/adapter-mariadb`, `@prisma/adapter-better-sqlite3`, ...).

## Usage

Copy the five models from `node_modules/@anievo-id/rbac-evolution-prisma/schema/rbac.prisma` into your schema (or
drop the file into a multi-file schema folder), then run `npx prisma migrate dev --name rbac`.

```ts
import { PrismaClient } from '@prisma/client'
import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'

const prisma = new PrismaClient() // Prisma 5 / 6; Prisma 7: see below

export const rbac = createRbac({
  adapter: new PrismaAdapter(prisma, { skipDuplicates: true }), // PostgreSQL, CockroachDB, MySQL, MariaDB
})

await rbac.for({ type: 'user', id: currentUser.id }).can('edit articles')
```

- Keep the model names (`RbacPermission`, `RbacRole`, ...). Table and column names (`@@map` / `@map`) can change.
- On SQLite and SQL Server, leave `skipDuplicates` off: those connectors don't support it.
- `team_id = ''` means "global". Don't use `''` as a real team id.
- MySQL uses the database's default collation, which is usually case-insensitive. The adapter compares every row
  exactly, but the unique keys still follow the collation. For case-sensitive names, use `utf8mb4_0900_bin`
  (MySQL 8) or `utf8mb4_nopad_bin` (MariaDB).
- Prisma 7: generate with `provider = "prisma-client"` and an `output`, import `PrismaClient` from `<output>/client`,
  put the datasource URL in `prisma.config.ts`, pass a driver adapter, and run `prisma generate` yourself after
  `migrate dev` / `db push`. Nothing changes on the adapter side:

  ```ts
  import { PrismaPg } from '@prisma/adapter-pg'
  import { PrismaClient } from './generated/prisma/client'

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
  const rbac = createRbac({ adapter: new PrismaAdapter(prisma) })
  ```

- MongoDB is not supported. Use the
  [Mongoose adapter](https://www.npmjs.com/package/@anievo-id/rbac-evolution-mongoose) instead.

## Documentation

https://creation.anievo.id/rbac-evolution/adapters/prisma

## License

MIT
