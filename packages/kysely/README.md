# @anievo-id/rbac-evolution-kysely

[Kysely](https://kysely.dev) storage adapter for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): one
adapter for PostgreSQL, MySQL, SQLite and SQL Server.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-kysely kysely
```

Install your database driver as usual. `kysely` 0.27 or later is required.

## Usage

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacTables, kyselyAdapter, type RbacDatabase } from '@anievo-id/rbac-evolution-kysely'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

const db = new Kysely<RbacDatabase>({
  dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }) }),
})

await createRbacTables(db) // or rbacMigration() in your Kysely migrations

export const rbac = createRbac({ adapter: kyselyAdapter(db) })
```

- The dialect is detected from the `Kysely` instance. Pass `{ dialect }` if detection fails, and `{ prefix }`
  for prefixed table names.
- Every dialect, SQL Server included, runs the full adapter conformance suite against a real server in CI.
- `team_id = ''` means "global". Don't use `''` as a real team id.
- MySQL and SQL Server columns use binary collations (`utf8mb4_bin`, `Latin1_General_100_BIN2`), so names compare
  case-sensitively. The adapter re-checks every row it reads, because both ignore trailing spaces.

## Documentation

https://creation.anievo.id/rbac-evolution/adapters/kysely

## License

MIT
