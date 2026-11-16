# Querying subjects

Most checks start from a subject ("can **this user** edit articles?"). Sometimes you need the reverse: "**which users** are writers?" or "who may edit articles?". The engine has two methods for that, plus `hasExactRoles` for strict role checks on one subject.

## `subjectsWithRole`

Returns the ids of subjects of the given type that have **any** of the given roles.

<!-- doc-test: skip -->
```ts
rbac.subjectsWithRole(
  subjectType: string,
  roles: RoleName | Role | (RoleName | Role)[],
  options?: { guard?: string; team?: TeamId },
): Promise<Id[]>
```

```ts
await rbac.subjectsWithRole('user', 'writer')                 // ['1', '4']
await rbac.subjectsWithRole('user', ['writer', 'editor'])     // writers OR editors
await rbac.subjectsWithRole('client', 'integration', { guard: 'api' })
await rbac.subjectsWithRole('user', 'admin', { team: 42 })    // admins in team 42
```

## `subjectsWithPermission`

Returns the ids of subjects of the given type that have **any** of the given permissions, either **directly or through one of their roles**.

<!-- doc-test: skip -->
```ts
rbac.subjectsWithPermission(
  subjectType: string,
  permissions: PermissionName | Permission | (PermissionName | Permission)[],
  options?: { guard?: string; team?: TeamId },
): Promise<Id[]>
```

```ts
await rbac.subjectsWithPermission('user', 'edit articles')
await rbac.subjectsWithPermission('user', ['edit articles', 'delete articles'])
await rbac.subjectsWithPermission('user', 'edit articles', { team: 42, guard: 'api' })
```

Each id appears only once, even if a subject matches several roles or has the permission both directly and through a role.

## Loading the records

Both methods return **ids only**. Load the records with your own ORM:

::: code-group

```ts [Prisma]
const ids = await rbac.subjectsWithRole('user', 'writer')
const writers = await prisma.user.findMany({
  where: { id: { in: ids.map(Number) } }, // SQL adapters return ids as strings
})
```

```ts [Drizzle]
import { inArray } from 'drizzle-orm'

const ids = await rbac.subjectsWithPermission('user', 'edit articles')
const editors = await db
  .select()
  .from(users)
  .where(inArray(users.id, ids.map(Number)))
```

:::

::: tip Id types
The Prisma and Drizzle adapters store `subject_id` as text, so they always return **strings** (`'1'`). `MemoryAdapter` returns ids in the form you stored them. Convert with `Number(...)` when your primary key is numeric. UUID keys need no conversion.
:::

## Scope: guard and team

- **Guard.** Only roles and permissions of the given guard (default: `defaultGuard`) are considered.
- **Team.** With [teams](/basic-usage/teams) enabled, `team` selects which assignments count. Only role and permission links made **in that team** match. A role name resolves the same way as everywhere else: a team-specific role wins over a global role with the same name.
- Passing `team` when `teams` is off throws `RbacError` with code `TEAMS_NOT_ENABLED`.

```ts
// Users who hold the global 'admin' role inside team 42
await rbac.subjectsWithRole('user', 'admin', { team: 42 })

// Users who hold 'admin' with no team (global assignments)
await rbac.subjectsWithRole('user', 'admin')
```

## Errors

Unknown names throw, the same way assignments do:

| Situation | Error |
| --- | --- |
| A role name doesn't exist in that guard / team | `RoleDoesNotExist` |
| A permission name doesn't exist in that guard | `PermissionDoesNotExist` |
| A `Role` / `Permission` object has another guard | `GuardDoesNotMatch` |
| A `Role` object belongs to another team | `RbacError` (`TEAM_DOES_NOT_MATCH`) |

See [Errors](/advanced/errors) for the full list.

## Caveats

::: warning Wildcards are not expanded
`subjectsWithPermission` matches stored permission **rows**, not wildcard patterns. A user who holds `articles.*` is **not** returned by `subjectsWithPermission('user', 'articles.edit')`. The name you pass must also exist as a permission, or the call throws `PermissionDoesNotExist`.

To include wildcard holders, query the patterns too:

```ts
await rbac.subjectsWithPermission('user', ['articles.edit', 'articles.*', '*'])
```

Every name in that list must exist as a permission. See [Wildcard permissions](/basic-usage/wildcard-permissions).
:::

::: warning Super-admins and `before` are not included
`superAdminRoles` and the `before` hook only affect `can()` and friends. These queries look only at stored data, so a super-admin appears in the results only if they actually hold the role or permission. To include them, query the super-admin role separately and merge the ids:

```ts
const ids = new Set([
  ...(await rbac.subjectsWithPermission('user', 'edit articles')),
  ...(await rbac.subjectsWithRole('user', 'super-admin')),
])
```
:::

## `hasExactRoles`

On a single subject, `hasExactRoles` is `true` only when the subject holds **all** of the given roles and **no other** role in the current guard and team.

```ts
const user = rbac.for({ type: 'user', id: 1 })
await user.syncRoles('writer', 'editor')

await user.hasExactRoles('writer', 'editor')            // true
await user.hasExactRoles(['writer', 'editor'])          // true (array form)
await user.hasExactRoles('writer')                      // false: also has editor
await user.hasExactRoles('writer', 'editor', 'admin')   // false: no admin
```

Compare it with the other role checks:

| Method | True when the subject has... |
| --- | --- |
| `hasRole(a)` / `hasRole([a, b])` | `a` / any of `a`, `b` |
| `hasAnyRole(a, b)` | any of them |
| `hasAllRoles(a, b)` | all of them, others allowed |
| `hasExactRoles(a, b)` | all of them and nothing else |

Role checks never throw for unknown names. They return `false`.
