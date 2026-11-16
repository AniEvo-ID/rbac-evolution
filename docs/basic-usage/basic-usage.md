# Basic usage

All examples assume an engine created once and shared across your app:

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

export const rbac = createRbac({ adapter: new MemoryAdapter() })
```

## Subjects

A **subject** is whatever receives roles and permissions. Usually it is a user, but it can be anything: an API client, a service account, an organization. A subject is a plain object with a `type` and an `id`:

```ts
const subject = { type: 'user', id: 1 }       // number ids
const client = { type: 'client', id: 'c_9f1c' } // string ids (UUIDs, ...)
```

The `type` keeps different kinds of subjects apart, so `user#1` and `client#1` never share roles. You don't need to change your user model or table.

To work with a subject, scope the engine to it with `rbac.for()`:

```ts
const user = rbac.for({ type: 'user', id: 1 })

await user.assignRole('writer')
await user.can('edit articles')
```

`rbac.for()` is cheap. It does not query anything, so you can call it per request.

It also takes a scope as a second argument:

```ts
rbac.for(user, { guard: 'api' })  // see Multiple guards
rbac.for(user, { team: 42 })      // see Teams
```

## Creating permissions and roles

```ts
const permission = await rbac.createPermission('edit articles')
const role = await rbac.createRole('writer')
```

Both return the stored object:

```ts
// permission: { id: 1, name: 'edit articles', guardName: 'web' }
// role:       { id: 2, name: 'writer', guardName: 'web', teamId: null }
```

Names are trimmed and must not be empty. Creating a name that already exists (in the same guard) throws `PermissionAlreadyExists` or `RoleAlreadyExists`.

## Finding

```ts
await rbac.findPermission('edit articles')       // Permission | null
await rbac.findPermissionOrFail('edit articles') // Permission, or throws PermissionDoesNotExist

await rbac.findRole('writer')                    // Role | null
await rbac.findRoleOrFail('writer')              // Role, or throws RoleDoesNotExist
```

List everything in a guard:

```ts
await rbac.getPermissions() // Permission[]
await rbac.getRoles()       // Role[]
```

## Find or create

Handy in seeders, which may run more than once:

```ts
await rbac.findOrCreatePermission('edit articles')
await rbac.findOrCreateRole('writer')
```

## Deleting

```ts
await rbac.deletePermission('edit articles')
await rbac.deleteRole('writer')
```

Deleting also removes the role or permission from every subject and role that had it. Deleting a name that doesn't exist throws `PermissionDoesNotExist` or `RoleDoesNotExist`.

With [teams](/basic-usage/teams#deleting-a-team), `rbac.deleteTeam(teamId)` removes a whole team: every assignment in it and the roles created for it.

## Names or objects

Every method that takes a role or permission accepts either the name or the object returned by `create*` / `find*`:

```ts
const writer = await rbac.findRoleOrFail('writer')

await rbac.for(user).assignRole('writer')
await rbac.for(user).assignRole(writer) // same thing
```

Methods that take several items accept them as separate arguments or as an array:

```ts
await rbac.for(user).assignRole('writer', 'editor')
await rbac.for(user).assignRole(['writer', 'editor'])
```

## Subject methods

`rbac.for(subject)` returns a `SubjectRbac` with these methods. All of them return promises.

| Method | Description |
| --- | --- |
| `assignRole(...roles)` | Add roles |
| `removeRole(...roles)` | Remove roles |
| `syncRoles(...roles)` | Replace all roles with the given ones |
| `hasRole(role \| roles[])` | Has the role (or any of the roles) |
| `hasAnyRole(...roles)` | Has at least one of the roles |
| `hasAllRoles(...roles)` | Has every one of the roles |
| `hasExactRoles(...roles)` | Has exactly these roles and no others |
| `getRoles()` / `getRoleNames()` | The subject's roles, as objects or names |
| `givePermissionTo(...permissions)` | Add direct permissions |
| `revokePermissionTo(...permissions)` | Remove direct permissions |
| `syncPermissions(...permissions)` | Replace all direct permissions |
| `revokeAll(options?)` | Remove every role and direct permission (current guard and team, or wider with `allGuards` / `allTeams`). See [Teams](/basic-usage/teams#removing-a-member). |
| `teams(options?)` | Ids of the teams where the subject has a role or direct permission. See [Teams](/basic-usage/teams#listing-a-subject-s-teams). |
| `can(p)` / `cannot(p)` | Authorization check. Respects [`before` and super-admins](/basic-usage/super-admin). Never throws. |
| `canAny(...p)` / `canAll(...p)` | `can()` for several permissions |
| `hasPermissionTo(p)` | Data check, direct or via roles. Throws if `p` doesn't exist. |
| `hasDirectPermission(p)` | Data check, direct permissions only. Throws if `p` doesn't exist. |
| `hasAnyPermission(...p)` / `hasAllPermissions(...p)` | Data check for several permissions. Never throws. |
| `getDirectPermissions()` | Permissions given directly |
| `getPermissionsViaRoles()` | Permissions inherited from roles |
| `getAllPermissions()` / `getPermissionNames()` | Both combined, as objects or names |
| `snapshot()` | `{ roles, permissions }` as plain names, safe to send to the client |

The subject helper also exposes `subject`, `guardName` and `teamId`.

::: tip `can()` or `hasPermissionTo()`?
Use `can()` for authorization decisions. It never throws and it honors super-admin rules. Use `hasPermissionTo()` when you want to know what is actually stored, and want to be told (with an error) about typos in permission names.
:::

## Role methods

`rbac.role(name)` returns a `RoleRbac`:

| Method | Description |
| --- | --- |
| `get()` | The role object. Throws `RoleDoesNotExist` if missing. |
| `givePermissionTo(...permissions)` | Add permissions to the role |
| `revokePermissionTo(...permissions)` | Remove permissions from the role |
| `syncPermissions(...permissions)` | Replace all permissions of the role |
| `getPermissions()` / `getPermissionNames()` | The role's permissions |
| `hasPermissionTo(p)` | Whether the role has the permission |

See [Permissions via roles](/basic-usage/roles).

## Caching

Each subject's roles and permissions are cached (in memory by default, for 24 hours). The cache is cleared automatically after every change made through `rbac`. If you change the tables by other means, clear it yourself:

```ts
await rbac.forgetCachedPermissions()
```

See [Cache](/advanced/cache) for custom stores like Redis.
