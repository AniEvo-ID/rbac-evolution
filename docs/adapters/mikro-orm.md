# MikroORM

[MikroORM](https://mikro-orm.io) 7 runs its SQL drivers on [Kysely](https://kysely.dev), and `em.getKysely()` gives
you that Kysely instance. So you don't need a separate package: the [Kysely adapter](/adapters/kysely) works on it
directly, on PostgreSQL, MySQL / MariaDB, SQLite and SQL Server.

::: info MikroORM 6
MikroORM 6 runs on knex, not Kysely, so this page needs MikroORM 7 or later (which needs Node.js 22.17+). On
MikroORM 6, use the [Kysely adapter](/adapters/kysely) with its own Kysely instance on the same database, or
[write a custom adapter](/adapters/custom).
:::

## Install

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-kysely
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-kysely
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-kysely
```

:::

`kysely` comes with MikroORM; you don't install it yourself.

## Schema

Create the five tables with a MikroORM migration. `this.getEntityManager().getKysely()` runs in the migration's
transaction:

```ts
// src/migrations/Migration20261119000000_rbac.ts
import { Migration } from '@mikro-orm/migrations'
import { createRbacTables, dropRbacTables } from '@anievo-id/rbac-evolution-kysely'

export class Migration20261119000000_rbac extends Migration {
  override async up(): Promise<void> {
    await createRbacTables(this.getEntityManager().getKysely())
  }

  override async down(): Promise<void> {
    await dropRbacTables(this.getEntityManager().getKysely())
  }
}
```

The tables are the same as the Kysely adapter's: see [Schema](/adapters/kysely#schema) for the prefix and expiry
options. They have no entities, so the schema generator leaves them alone.

## Adapter

```ts
// src/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { kyselyAdapter } from '@anievo-id/rbac-evolution-kysely'
import { orm } from './orm'

export const rbac = createRbac({ adapter: kyselyAdapter(orm.em.getKysely()) })
```

`orm.em.getKysely()` outside a transaction is bound to the connection pool, so this instance works in any request.
The adapter detects the database from the Kysely instance; pass `{ dialect }` if it can't.

## Transactions

Inside `em.transactional()`, `em.getKysely()` runs in that transaction. Build a short-lived engine on it, so the rbac
writes commit or roll back with yours:

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { kyselyAdapter } from '@anievo-id/rbac-evolution-kysely'

await orm.em.fork().transactional(async (em) => {
  const user = em.create(User, { email: 'ana@example.com' })
  await em.flush()
  const txRbac = createRbac({ adapter: kyselyAdapter(em.getKysely()), cache: false })
  await txRbac.for({ type: 'user', id: user.id }).assignRole('writer')
})

// The main instance may hold cached lookups from before the transaction.
await rbac.forgetCachedPermissions()
```

::: tip
`cache: false` on the transaction instance keeps uncommitted data out of any cache. See [Cache](/advanced/cache).
:::

## NestJS

With `@mikro-orm/nestjs`, inject the `MikroORM` instance. Import it from your driver package, so `orm.em` has
`getKysely()`:

```ts
// rbac.module.ts
import { Module } from '@nestjs/common'
import { MikroORM } from '@mikro-orm/postgresql'
import { RbacModule } from '@anievo-id/rbac-evolution-nestjs'
import { createRbac } from '@anievo-id/rbac-evolution'
import { kyselyAdapter } from '@anievo-id/rbac-evolution-kysely'

@Module({
  imports: [
    RbacModule.forRootAsync({
      inject: [MikroORM],
      useFactory: (orm: MikroORM) => ({
        rbac: createRbac({ adapter: kyselyAdapter(orm.em.getKysely()) }),
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

See the [Kysely adapter](/adapters/kysely) for the behaviour notes, which are the same here.
