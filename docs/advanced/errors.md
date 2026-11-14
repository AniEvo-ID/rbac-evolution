# Errors

Every error the engine throws on purpose is an instance of `RbacError`, and each one has a machine-readable `code`. Errors from your adapter or database (connection failures, constraint violations) are **not** wrapped and reach you unchanged.

```ts
import { RbacError } from '@anievo-id/rbac-evolution'

try {
  await rbac.for(user).assignRole('ghost')
} catch (error) {
  if (error instanceof RbacError) {
    console.log(error.code)    // 'ROLE_DOES_NOT_EXIST'
    console.log(error.name)    // 'RoleDoesNotExist'
    console.log(error.message) // 'There is no role named `ghost` for guard `web`.'
  }
  throw error
}
```

## Error classes

All classes extend `RbacError`, which extends `Error`, and all are exported from `@anievo-id/rbac-evolution`.

| Class | `code` | Thrown when |
| --- | --- | --- |
| `PermissionDoesNotExist` | `PERMISSION_DOES_NOT_EXIST` | A permission name can't be found in the guard. |
| `PermissionAlreadyExists` | `PERMISSION_ALREADY_EXISTS` | `createPermission` is called with a name that already exists in the guard. |
| `RoleDoesNotExist` | `ROLE_DOES_NOT_EXIST` | A role name can't be found in the guard and team. |
| `RoleAlreadyExists` | `ROLE_ALREADY_EXISTS` | `createRole` is called with a name that already exists in the same guard **and** team. |
| `GuardDoesNotMatch` | `GUARD_DOES_NOT_MATCH` | A `Role` or `Permission` **object** belongs to a different guard than the current scope. |
| `InvalidWildcardPermission` | `INVALID_WILDCARD_PERMISSION` | With `wildcard: true`, a permission name is malformed (empty, or has an empty part or subpart like `articles..edit` or `articles.edit,`). |

These codes are thrown as plain `RbacError` instances. Use `error.code` to tell them apart:

| `code` | Thrown when |
| --- | --- |
| `TEAMS_NOT_ENABLED` | A `team` option (other than `null`/`undefined`) is passed while `createRbac({ teams: true })` is not set. |
| `TEAM_DOES_NOT_MATCH` | A `Role` **object** from another team is used in a team scope. Global roles (`teamId: null`) are always allowed. |
| `INVALID_NAME` | A role or permission name is empty or only whitespace. Names are trimmed before use. |

The `RbacErrorCode` type is the union of all nine codes.

## Where each error comes from

| Method | Can throw |
| --- | --- |
| `createPermission` | `PermissionAlreadyExists`, `InvalidWildcardPermission`, `INVALID_NAME` |
| `createRole` | `RoleAlreadyExists`, `TEAMS_NOT_ENABLED`, `INVALID_NAME` |
| `findPermissionOrFail` / `findRoleOrFail` | `PermissionDoesNotExist` / `RoleDoesNotExist` |
| `deletePermission` / `deleteRole` | `PermissionDoesNotExist` / `RoleDoesNotExist`; `deleteRole` with `team` also `TEAMS_NOT_ENABLED` |
| `assignRole`, `removeRole`, `syncRoles` | `RoleDoesNotExist`, `GuardDoesNotMatch`, `TEAM_DOES_NOT_MATCH` |
| `givePermissionTo`, `revokePermissionTo`, `syncPermissions` (subject or role) | `PermissionDoesNotExist`, `GuardDoesNotMatch`; on a role, also `RoleDoesNotExist` if the role is missing |
| `hasPermissionTo`, `hasDirectPermission` | `PermissionDoesNotExist` (only when `wildcard` is off), `GuardDoesNotMatch` |
| `subjectsWithRole` / `subjectsWithPermission` | `RoleDoesNotExist` / `PermissionDoesNotExist`, `GuardDoesNotMatch` |
| `rbac.for(...)`, `rbac.role(...)` with `team` | `TEAMS_NOT_ENABLED` (thrown synchronously) |
| `can`, `cannot`, `canAny`, `canAll`, `hasAnyPermission`, `hasAllPermissions` | Never throw an `RbacError` (see below) |
| `hasRole`, `hasAnyRole`, `hasAllRoles`, `hasExactRoles` | Never throw for unknown names. They return `false`. |

Because any method can also fail with an adapter or database error, wrap writes in your usual error handling.

## `can()` vs `hasPermissionTo()`

Both answer "does this subject have this permission?", but they are meant for different jobs:

| | `hasPermissionTo(p)` | `can(p)` |
| --- | --- | --- |
| Unknown permission name | **Throws** `PermissionDoesNotExist` (wildcard off) | Returns `false` |
| Other `RbacError`s (guard mismatch, ...) | Throws | Returns `false` |
| `before` hook | Not applied | Applied first |
| `superAdminRoles` | Not applied | Applied after `before` |
| Adapter / database errors | Thrown | Thrown |
| Use it for | Data checks, admin tooling, tests: a typo should fail loudly | Authorization in routes, middleware and UI |

```ts
const rbac = createRbac({ adapter, superAdminRoles: ['super-admin'] })
const root = rbac.for({ type: 'user', id: 1 })
await root.assignRole('super-admin')

await root.can('edit artcles')             // true: super-admins pass every can()
await root.hasPermissionTo('edit artcles') // throws PermissionDoesNotExist (typo)

const guest = rbac.for({ type: 'user', id: 2 })
await guest.can('edit artcles')            // false: the error is swallowed
```

`cannot(p)` is `!can(p)`. `canAny` / `canAll` call `can` for each permission. `hasAnyPermission` / `hasAllPermissions` are pure data checks like `hasPermissionTo`, but they return `false` instead of throwing.

::: tip
A typo in a permission name passed to `can()` fails silently, because the check simply returns `false`. Use [typed names](/basic-usage/typed-names) so the compiler catches it.
:::

## Handling errors in an API

```ts
import { RbacError } from '@anievo-id/rbac-evolution'

function toHttpStatus(error: RbacError): number {
  switch (error.code) {
    case 'ROLE_DOES_NOT_EXIST':
    case 'PERMISSION_DOES_NOT_EXIST':
      return 404
    case 'ROLE_ALREADY_EXISTS':
    case 'PERMISSION_ALREADY_EXISTS':
      return 409
    default:
      return 422 // invalid name, guard/team mismatch, bad wildcard, teams disabled
  }
}

app.post('/users/:id/roles', async (req, res) => {
  try {
    await rbac.for({ type: 'user', id: req.params.id }).assignRole(req.body.role)
    res.status(204).end()
  } catch (error) {
    if (error instanceof RbacError) {
      return res.status(toHttpStatus(error)).json({ code: error.code, message: error.message })
    }
    throw error
  }
})
```

::: info Duplicates under race conditions
`createRole` and `createPermission` look up the name before inserting. If two requests create the same name at the same moment, both can pass that check. The second insert is then stopped by the database's unique index, and you get the **adapter's** error (for example Prisma `P2002`), not `RoleAlreadyExists`. Use `findOrCreateRole` / `findOrCreatePermission` in seed scripts.
:::
