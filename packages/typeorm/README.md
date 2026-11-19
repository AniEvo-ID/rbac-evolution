# @anievo-id/rbac-evolution-typeorm

[TypeORM](https://typeorm.io) adapter for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution):
PostgreSQL, MySQL / MariaDB, SQLite and SQL Server through your `DataSource`, on TypeORM 0.3.20+ and 1.x.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-typeorm
```

## Usage

```ts
import { DataSource } from 'typeorm'
import { createRbac } from '@anievo-id/rbac-evolution'
import { rbacMigration, typeormAdapter } from '@anievo-id/rbac-evolution-typeorm'

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  migrations: [rbacMigration(), 'dist/migrations/*.js'], // creates the five rbac tables
})

export const rbac = createRbac({ adapter: typeormAdapter(dataSource) })

// Inside a transaction: the rbac writes commit or roll back with yours.
await dataSource.transaction((manager) =>
  createRbac({ adapter: typeormAdapter(manager), cache: false }).for({ type: 'user', id: 1 }).assignRole('writer'),
)
```

- The same tables as the Kysely, Drizzle and Prisma adapters.
- `rbacExpiryMigration()` adds the `expires_at` columns for `typeormAdapter(dataSource, { expiry: true })`.
- No entities to register: `migration:generate` and `synchronize` leave the rbac tables alone.

## Documentation

https://creation.anievo.id/rbac-evolution/adapters/typeorm

## License

MIT
