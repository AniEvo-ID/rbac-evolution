# Memory adapter

`MemoryAdapter` keeps all roles, permissions and links in plain JavaScript arrays. It ships with the core package, so it needs no database and no setup.

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

const rbac = createRbac({ adapter: new MemoryAdapter() })
```

::: warning Data lives only in memory
Everything is lost when the process exits, and each `MemoryAdapter` instance is separate. Two server processes, or two serverless invocations, don't share data.
:::

## When to use it

| Use case | Why it fits |
| --- | --- |
| **Unit and integration tests** | Starts empty, runs fast, needs no cleanup. Create a new instance per test. See [Testing](/advanced/testing). |
| **Prototypes and demos** | Try out the API before you choose a database. |
| **Roles defined in code** | If roles and permissions are fixed at deploy time and the role assignments come from somewhere else (a JWT claim, a column on your user table), you can rebuild everything at startup. |

When roles change at runtime (admin screens, invitations, per-team roles), use a persistent adapter such as [Prisma](/adapters/prisma) or [Drizzle](/adapters/drizzle).

## Example: roles defined in code

Keep the role definitions in one module, and seed a fresh adapter from it when the process starts:

```ts
// rbac.ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

const ROLES = {
  viewer: ['view articles'],
  writer: ['view articles', 'edit articles'],
  admin: ['view articles', 'edit articles', 'delete articles', 'manage users'],
} as const

export type RoleName = keyof typeof ROLES
export type PermissionName = (typeof ROLES)[RoleName][number]

export const rbac = createRbac<{ roles: RoleName; permissions: PermissionName }>({
  adapter: new MemoryAdapter(),
})

export const ready = (async () => {
  const all = new Set<PermissionName>(Object.values(ROLES).flat())
  for (const name of all) await rbac.createPermission(name)

  for (const [role, permissions] of Object.entries(ROLES) as [RoleName, readonly PermissionName[]][]) {
    await rbac.createRole(role)
    await rbac.role(role).givePermissionTo(permissions)
  }
})()
```

Then attach each user's role from wherever you keep it:

```ts
import { rbac, ready, type PermissionName, type RoleName } from './rbac'

export async function userCan(user: { id: number; role: RoleName }, permission: PermissionName) {
  await ready
  const subject = rbac.for({ type: 'user', id: user.id })
  await subject.syncRoles(user.role) // keeps the in-memory link in sync with the user record
  return subject.can(permission)
}
```

::: tip
`syncRoles` emits events and clears the cache, so this pattern suits small apps. With many users, look up `user.role` and check the role's permissions yourself, or switch to a database adapter.
:::

## Behaviour

`MemoryAdapter` follows the same [adapter contract](/adapters/custom) as the database adapters and passes the shared conformance suite. A few details differ from the SQL adapters:

| Detail | MemoryAdapter | Prisma / Drizzle |
| --- | --- | --- |
| Role / permission ids | `number`, from one counter shared by roles and permissions | `number`, one auto-increment per table |
| `Role.teamId` | Returned exactly as you passed it (`42` stays `42`) | Returned as a string (`'42'`) |
| Subject ids from reverse lookups | Returned as first stored (`1` stays `1`) | Always strings |
| Subject id matching | `1` and `'1'` are the same subject | Same |
| Uniqueness | Only the engine checks it | Engine check plus a unique index |
| Returned objects | Copies, so changing them doesn't affect stored data | New objects per query |

## Resetting

There is no `reset()` method. Create a new instance instead, and a new `rbac` with it, because the engine also caches lookups:

```ts
let rbac = createRbac({ adapter: new MemoryAdapter() })

function reset() {
  rbac = createRbac({ adapter: new MemoryAdapter() })
}
```
