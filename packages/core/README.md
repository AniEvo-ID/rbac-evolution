# @anievo-id/rbac-evolution

Framework-agnostic RBAC engine for [rbac-evolution](https://github.com/AniEvo-ID/rbac-evolution) —
roles, permissions, guards, wildcards and teams. Inspired by
[spatie/laravel-permission](https://github.com/spatie/laravel-permission).

**Status: 🚧 early development — API may change before 1.0.**

```bash
npm i @anievo-id/rbac-evolution
```

## Quick start

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

const rbac = createRbac({ adapter: new MemoryAdapter() })

// define permissions & roles
await rbac.createPermission('edit articles')
await rbac.createPermission('delete articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

// assign to a user (any { type, id } works)
const user = rbac.for({ type: 'user', id: 1 })
await user.assignRole('writer')

await user.hasRole('writer')               // true
await user.hasPermissionTo('edit articles') // true
await user.can('delete articles')           // false
```

## Subjects

A subject is anything that holds roles — `{ type: string, id: string | number }`.
Use `rbac.for(subject)` to work with it:

| Method | Description |
| --- | --- |
| `assignRole(...roles)` / `removeRole(...roles)` / `syncRoles(...roles)` | Manage roles |
| `hasRole(role \| roles[])` / `hasAnyRole(...)` / `hasAllRoles(...)` | Check roles |
| `givePermissionTo(...)` / `revokePermissionTo(...)` / `syncPermissions(...)` | Manage direct permissions |
| `hasPermissionTo(p)` | Check a permission (direct or via roles). Throws if `p` doesn't exist |
| `can(p)` / `cannot(p)` / `canAny(...)` / `canAll(...)` | Same check, never throws |
| `hasDirectPermission(p)` | Check direct permissions only |
| `getRoleNames()` / `getPermissionNames()` / `getAllPermissions()` | Read access |
| `snapshot()` | `{ roles, permissions }` — serializable, for the client |

All methods accept names or objects, and either `fn('a', 'b')` or `fn(['a', 'b'])`.

## Roles

```ts
const writer = rbac.role('writer')
await writer.givePermissionTo('edit articles', 'delete articles')
await writer.revokePermissionTo('delete articles')
await writer.syncPermissions(['edit articles'])
await writer.getPermissionNames() // ['edit articles']
```

## Guards

Like Laravel guards — separate sets of roles/permissions (e.g. `web` and `api`):

```ts
await rbac.createPermission('edit articles', { guard: 'api' })
await rbac.for(client, { guard: 'api' }).givePermissionTo('edit articles')
```

The default guard is `web` (`createRbac({ defaultGuard: 'api' })` to change it).

## Wildcard permissions

```ts
const rbac = createRbac({ adapter, wildcard: true })

await rbac.createPermission('articles.*')
await rbac.for(user).givePermissionTo('articles.*')

await rbac.for(user).can('articles.edit')     // true
await rbac.for(user).can('articles.edit.own') // true
await rbac.for(user).can('posts.edit')        // false
```

Supports `*`, `articles.*`, `articles.edit,delete` and shorter permissions implying deeper ones.

## Teams (multi-tenancy)

```ts
const rbac = createRbac({ adapter, teams: true })

await rbac.createRole('admin')                 // global role, usable in any team
await rbac.createRole('manager', { team: 42 }) // only exists in team 42

await rbac.for(user, { team: 42 }).assignRole('admin')
await rbac.for(user, { team: 42 }).hasRole('admin') // true
await rbac.for(user, { team: 7 }).hasRole('admin')  // false
```

## Caching

Each subject's roles & permissions are cached (in memory by default, 24h TTL) and the
cache is cleared automatically on every change. Plug in your own store (Redis, KV, ...):

```ts
createRbac({ adapter, cache: myStore, cacheTtl: 60_000 }) // implements CacheStore
createRbac({ adapter, cache: false })                      // disable
```

## Adapters

`MemoryAdapter` is built in. Prisma, Drizzle and others are planned as separate packages.
To support another database, implement the `RbacAdapter` interface.

> ⚠️ Client-side checks are for UI only. Always enforce permissions on the server.

## License

MIT
