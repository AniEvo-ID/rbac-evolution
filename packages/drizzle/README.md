# @anievo-id/rbac-evolution-drizzle

[Drizzle ORM](https://orm.drizzle.team) storage adapter for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution),
for PostgreSQL, SQLite and MySQL.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-drizzle drizzle-orm
```

## Usage

```ts
// db/schema.ts: drizzle-kit only picks up top-level exports, so destructure the tables
import { pgRbacSchema } from '@anievo-id/rbac-evolution-drizzle/pg'

export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = pgRbacSchema()
```

```ts
// lib/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzlePgAdapter } from '@anievo-id/rbac-evolution-drizzle/pg'
import { drizzle } from 'drizzle-orm/node-postgres'

export const rbac = createRbac({ adapter: drizzlePgAdapter(drizzle(process.env.DATABASE_URL!)) })
```

Then run `npx drizzle-kit generate` and `npx drizzle-kit migrate` as usual.

| Dialect    | Entry point                                | Schema / adapter                               |
| ---------- | ------------------------------------------ | ---------------------------------------------- |
| PostgreSQL | `@anievo-id/rbac-evolution-drizzle/pg`     | `pgRbacSchema()` / `drizzlePgAdapter(db)`      |
| SQLite     | `@anievo-id/rbac-evolution-drizzle/sqlite` | `sqliteRbacSchema()` / `drizzleSqliteAdapter(db)` |
| MySQL      | `@anievo-id/rbac-evolution-drizzle/mysql`  | `mysqlRbacSchema()` / `drizzleMysqlAdapter(db)` |

- Without drizzle-kit, run the plain SQL shipped in `sql/pg.sql`, `sql/sqlite.sql` or `sql/mysql.sql`.
- With a table prefix (`pgRbacSchema({ prefix: 'rbac_' })`), pass the same schema object to the adapter:
  `drizzlePgAdapter(db, rbacTables)`.
- `team_id = ''` means "global". Don't use `''` as a real team id.
- MySQL string columns use `utf8mb4_bin`, so names compare case-sensitively. That collation ignores trailing spaces,
  so the adapter re-checks every row it reads.

## Documentation

https://creation.anievo.id/rbac-evolution/adapters/drizzle

## License

MIT
