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
| `hasAnyPermission(...)` / `hasAllPermissions(...)` | Data check for several permissions, never throws |
| `hasExactRoles(...roles)` | Has all of these roles and no others |
| `getRoles()` / `getRoleNames()` | Read roles |
| `getDirectPermissions()` / `getPermissionsViaRoles()` / `getAllPermissions()` / `getPermissionNames()` | Read permissions |
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

## Super-admin

Like spatie's `Gate::before`, you can let some subjects pass every check:

```ts
const rbac = createRbac({ adapter, superAdminRoles: ['super-admin'] })

await rbac.for(root).assignRole('super-admin')
await rbac.for(root).can('anything')              // true, even if the permission doesn't exist
await rbac.for(root).hasPermissionTo('edit articles') // false: pure data check
```

For full control use a `before` hook. Return `true` to allow, `false` to deny, or
`undefined` to continue with the normal check. It may be async:

```ts
createRbac({
  adapter,
  superAdminRoles: ['super-admin'],
  before: async ({ subject, permission }) => {
    if (permission === 'delete everything') return false // nobody, not even super-admins
    if (await isBanned(subject.subject)) return false
    return undefined
  },
})
```

`before` runs first. If it returns `undefined`, `superAdminRoles` is checked, then the normal
check. `subject` is the scoped `SubjectRbac` (it has `subject`, `guardName`, `teamId`, `hasRole()`...).

> As in spatie, only `can()`, `cannot()`, `canAny()` and `canAll()` use `before` and
> `superAdminRoles`. `hasPermissionTo()`, `hasDirectPermission()`, `hasAnyPermission()`,
> `hasAllPermissions()` and the role checks only look at the stored data.

## Events

```ts
const off = rbac.on('role.attached', async ({ subject, roles, teamId }) => {
  await audit.log(`${subject.type}#${subject.id} got ${roles.map((r) => r.name).join(', ')}`)
})
off() // or rbac.off('role.attached', listener)
```

| Event | Fired by | Payload |
| --- | --- | --- |
| `role.attached` / `role.detached` | `assignRole`, `removeRole`, `syncRoles` | `{ subject, roles, guardName, teamId }` |
| `permission.attached` / `permission.detached` | `givePermissionTo`, `revokePermissionTo`, `syncPermissions` on a subject or a role | `{ target: 'subject', subject, ... }` or `{ target: 'role', role, ... }`, plus `{ permissions, guardName, teamId }` |
| `role.created` / `role.deleted` | `createRole` (and `findOrCreateRole`), `deleteRole` | `{ role, teamId }` |
| `permission.created` / `permission.deleted` | `createPermission` (and `findOrCreatePermission`), `deletePermission` | `{ permission }` |

Every payload has an `event` field, so `RbacEvent` is a discriminated union.

- Events fire only after the adapter write succeeds and the cache has been cleared.
- Listeners run in registration order. Async listeners are awaited one by one, and the
  method (e.g. `assignRole`) resolves after all of them. If a listener throws, the error
  reaches the caller, but the change is already saved.
- Only real changes are reported. Assigning a role the subject already has emits nothing.
  `sync*` emits `detached` for what was removed and then `attached` for what was added.
- To find what changed, attach/detach do one extra adapter read, but only when a listener
  is registered for that event.
- Deleting a role or permission emits only `*.deleted`, not `detached` for every subject.

## Typed names

Like spatie's enum support, you can tell the engine which permission and role names are valid:

```ts
type AppRbac = {
  permissions: 'edit articles' | 'delete articles'
  roles: 'writer' | 'admin'
}

const rbac = createRbac<AppRbac>({ adapter })

await rbac.for(user).can('edit articles') // ok
await rbac.for(user).can('fly')           // type error
await rbac.for(user).assignRole('ghost')  // type error
```

TS string enums work too, either as enum members or as their literal values:

```ts
enum Perm { Edit = 'edit articles', Delete = 'delete articles' }
const rbac = createRbac<{ permissions: Perm }>({ adapter }) // roles: any string

await rbac.for(user).can(Perm.Edit)       // ok
await rbac.for(user).can('edit articles') // ok
```

- Name inputs are type-checked everywhere: `createPermission`, `findRole`, `role()`,
  `givePermissionTo`, `can`, `hasRole`, `assignRole`, `superAdminRoles`, the query methods, and so on.
  `Permission` and `Role` objects are always accepted.
- Return values (`getRoleNames()`, `snapshot()`, ...) stay `string[]`, because the database may
  contain other names.
- With `wildcard: true`, add the names you check to the union too (`'articles.*' | 'articles.edit'`).
- With no type argument everything accepts `string`, as before. `Rbac`, `SubjectRbac` and
  `RoleRbac` without type arguments still work, and a typed instance can be passed where `Rbac` is expected.
- Helper types: `RbacTypeConfig`, `PermissionName<T>`, `RoleName<T>`.

## Querying subjects

Like spatie's `User::role('writer')` and `User::permission('edit articles')` scopes, these return
the ids of matching subjects of a type:

```ts
await rbac.subjectsWithRole('user', 'writer')                  // [1, 4]
await rbac.subjectsWithRole('user', ['writer', 'editor'])      // any of the roles
await rbac.subjectsWithPermission('user', 'edit articles')     // direct or via a role
await rbac.subjectsWithPermission('user', 'edit articles', { team: 42, guard: 'api' })
```

- Unknown names throw `RoleDoesNotExist` / `PermissionDoesNotExist`.
- Wildcard patterns are not expanded. A subject is found only if it has exactly that permission,
  directly or through a role.

On a subject, `hasExactRoles('writer', 'editor')` is `true` only if the subject has exactly
those roles, no more and no fewer.

## Caching

Each subject's roles & permissions are cached (in memory by default, 24h TTL) and the
cache is cleared automatically on every change. Plug in your own store (Redis, KV, ...):

```ts
createRbac({ adapter, cache: myStore, cacheTtl: 60_000 }) // implements CacheStore
createRbac({ adapter, cache: false })                      // disable
```

## Adapters

`MemoryAdapter` is built in. For databases use [`@anievo-id/rbac-evolution-prisma`](https://www.npmjs.com/package/@anievo-id/rbac-evolution-prisma) or [`@anievo-id/rbac-evolution-drizzle`](https://www.npmjs.com/package/@anievo-id/rbac-evolution-drizzle).
To support another database, implement the `RbacAdapter` interface.

> ⚠️ Client-side checks are for UI only. Always enforce permissions on the server.

## License

MIT
