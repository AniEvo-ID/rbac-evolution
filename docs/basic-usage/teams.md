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

## With the integrations

The framework packages accept a team as well, so the current tenant can be read per request. For example, the Express middleware takes `team: (req) => ...`, and the Next.js helpers accept a `team` option. The CLI has `--team <id>`. See [Express](/frameworks/express), [Next.js](/frameworks/nextjs) and [CLI](/basic-usage/cli).
