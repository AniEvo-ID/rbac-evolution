# @anievo-id/rbac-evolution

Framework-agnostic roles and permissions (RBAC) for JavaScript and TypeScript, modelled on
[spatie/laravel-permission](https://github.com/spatie/laravel-permission): guards, wildcards, teams, super-admins,
caching and events.

**Status: early development. The API may change before 1.0.**

## Install

```bash
npm i @anievo-id/rbac-evolution
```

## Usage

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

const rbac = createRbac({ adapter: new MemoryAdapter() })

await rbac.createPermission('edit articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

const user = rbac.for({ type: 'user', id: 1 }) // any { type, id }
await user.assignRole('writer')

await user.can('edit articles')   // true
await user.can('delete articles') // false
await user.snapshot()             // { roles: ['writer'], permissions: ['edit articles'] }
```

`MemoryAdapter` is built in. For a database, use one of the adapter packages:
[Prisma](https://www.npmjs.com/package/@anievo-id/rbac-evolution-prisma),
[Drizzle](https://www.npmjs.com/package/@anievo-id/rbac-evolution-drizzle),
[Kysely](https://www.npmjs.com/package/@anievo-id/rbac-evolution-kysely) or
[Mongoose](https://www.npmjs.com/package/@anievo-id/rbac-evolution-mongoose).

## Typed names

Tell the engine which names are valid, and a typo becomes a compile error:

```ts
type AppRbac = {
  permissions: 'edit articles' | 'delete articles'
  roles: 'writer' | 'admin'
}

const rbac = createRbac<AppRbac>({ adapter })

await rbac.for(user).can('edit articles') // ok
await rbac.for(user).assignRole('ghost')  // type error
```

String enums work too. Return values (`getRoleNames()`, `snapshot()`, ...) stay `string[]`. See
[Typed names](https://creation.anievo.id/rbac-evolution/basic-usage/typed-names).

> Client-side checks are for the UI only. Always enforce permissions on the server.

## Documentation

https://creation.anievo.id/rbac-evolution/guide/introduction

## License

MIT
