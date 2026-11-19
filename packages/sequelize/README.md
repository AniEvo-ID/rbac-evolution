# @anievo-id/rbac-evolution-sequelize

[Sequelize](https://sequelize.org) 6 adapter for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution):
PostgreSQL, MySQL / MariaDB, SQLite and SQL Server through your Sequelize instance.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-sequelize
```

## Usage

```js
// migrations/20261119000000-rbac.js (sequelize-cli): creates the five rbac tables
module.exports = require('@anievo-id/rbac-evolution-sequelize').rbacMigration()
```

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { sequelizeAdapter } from '@anievo-id/rbac-evolution-sequelize'

export const rbac = createRbac({ adapter: sequelizeAdapter(sequelize) })

// Inside a transaction: the rbac writes commit or roll back with yours.
await sequelize.transaction((t) =>
  createRbac({ adapter: sequelizeAdapter(t), cache: false }).for({ type: 'user', id: 1 }).assignRole('writer'),
)
```

- The same tables as the Kysely, TypeORM, Drizzle and Prisma adapters.
- `rbacMigration()` works with sequelize-cli and Umzug; `rbacExpiryMigration()` adds the `expires_at` columns for
  `sequelizeAdapter(sequelize, { expiry: true })`.

## Documentation

https://creation.anievo.id/rbac-evolution/adapters/sequelize

## License

MIT
