# Teams

In a multi-tenant app the same user can be an admin in one organization and a plain member in another. Teams make role assignments depend on the team (tenant, organization, workspace, ...) you are looking at.

## Enabling teams

```ts
const rbac = createRbac({ adapter, teams: true })
```

Teams are off by default. Passing a `team` option while they are disabled throws an `RbacError` with code `TEAMS_NOT_ENABLED`.

A team id is a `string` or a `number`, whatever your tenants use. `null` means "no team".

## Scoping to a team

Pass the team when you scope the engine to a subject:

```ts
const user = { type: 'user', id: 1 }

await rbac.for(user, { team: 42 }).assignRole('admin')

await rbac.for(user, { team: 42 }).hasRole('admin') // true
await rbac.for(user, { team: 7 }).hasRole('admin')  // false
await rbac.for(user).hasRole('admin')               // false: no team is its own scope
```

Role assignments and [direct permissions](/basic-usage/direct-permissions) are stored per team. `syncRoles()` and `syncPermissions()` only replace what is in the current team.

::: tip
Resolve the current team once per request (from the URL, session or a header) and create the scoped helper there, so the rest of your code doesn't have to think about it.
:::

## Global and team roles

A role can be created for everyone or for one team:

```ts
await rbac.createRole('admin')                 // global role, can be assigned in any team
await rbac.createRole('manager', { team: 42 }) // only exists in team 42
```

- A **global role** (`teamId: null`) can be assigned in any team. The assignment itself is still per team.
- A **team role** can only be found and assigned inside its own team. Using it in another team throws `RoleDoesNotExist` (or an `RbacError` with code `TEAM_DOES_NOT_MATCH` if you pass the role object).
- If a team role and a global role share a name, the team role wins inside that team.

```ts
await rbac.for(user, { team: 42 }).assignRole('manager') // ok
await rbac.for(user, { team: 7 }).assignRole('manager')  // throws RoleDoesNotExist
```

Permissions are not team-specific. They are shared by all teams, and a role's permissions apply wherever the role is assigned.

## Working with team roles

The other role methods take the same `team` option:

```ts
await rbac.findRole('manager', { team: 42 })
await rbac.getRoles({ team: 42 })              // global roles + roles of team 42
await rbac.role('manager', { team: 42 }).givePermissionTo('approve invoices')
await rbac.deleteRole('manager', { team: 42 })
```

Querying subjects works per team too:

```ts
await rbac.subjectsWithRole('user', 'admin', { team: 42 })
```

## Listing a subject's teams

`teams()` returns the ids of the teams where the subject has a role or a direct permission, so you don't need a
membership table of your own just to answer "which teams is this user in?":

```ts
await rbac.for(user, { team: 42 }).assignRole('admin')
await rbac.for(user, { team: 7 }).givePermissionTo('edit articles')

await rbac.for(user).teams() // [42, 7]
```

- It ignores the scope's own team: `rbac.for(user, { team: 42 }).teams()` lists every team too.
- The global scope (`null`) is not a team, so it is never listed.
- It counts the scope's guard only. Pass `{ allGuards: true }` to count every guard.
- Ids come back the way the adapter stores them. The SQL and Mongoose adapters store team ids as text, so they
  return `['42', '7']`. Compare with `String(id)`. The order is not specified.
- It throws `TEAMS_NOT_ENABLED` without `teams: true`. The result is cached like other lookups, and cleared on
  every change.

## Removing a member

`revokeAll()` removes every role and direct permission of the subject in the scope's team and guard. It is
`syncRoles([])` plus `syncPermissions([])` in one call:

```ts
await rbac.for(user, { team: 42 }).revokeAll() // the user leaves team 42
```

Two options widen it:

| Call | Removes |
| --- | --- |
| `revokeAll()` | Roles and direct permissions in the current team and guard |
| `revokeAll({ allGuards: true })` | ...in the current team, every guard |
| `revokeAll({ allTeams: true })` | ...in every team and in the global scope, current guard |
| `revokeAll({ allGuards: true, allTeams: true })` | Everything the subject has, for example when you delete the user |

Roles and permissions themselves are not deleted, only the subject's links to them. `role.detached` and
`permission.detached` fire for what was actually removed, once per team and guard.

## Deleting a team

When a tenant closes their account, `deleteTeam()` removes everything the engine stores for that team:

```ts
await rbac.deleteTeam(42)
```

- Every role and direct permission held in the team, by any subject, in every guard.
- Every role created for the team (`createRole('manager', { team: 42 })`), with its permission links.
- Global roles and all permissions stay. So do the subject's roles in other teams and in the global scope.

It emits `role.detached` / `permission.detached` for each subject that lost something (one per guard), then
`role.deleted` for each team role, and clears the cache, so no member keeps cached access. It throws
`TEAMS_NOT_ENABLED` without `teams: true`. Your own data about the team (the organization row, its projects) is
yours to delete.

::: warning Not atomic
Like `sync()`, `deleteTeam()` makes several adapter calls. If one fails, the earlier ones stay done: run it
again to finish. Links are removed before the team's roles, so a failure never leaves anyone holding a deleted
role.
:::

`teams()`, `revokeAll({ allTeams: true })` and `deleteTeam()` need optional adapter methods. Every built-in adapter
has them. A [custom adapter](/adapters/custom#optional-methods) without them throws an `RbacError` with code
`ADAPTER_METHOD_MISSING`.

## With the integrations

The framework packages accept a team as well, so the current tenant can be read per request. For example, the Express middleware takes `team: (req) => ...`, and the Next.js helpers accept a `team` option. The CLI has `--team <id>`. See [Express](/frameworks/express), [Next.js](/frameworks/nextjs) and [CLI](/basic-usage/cli).
