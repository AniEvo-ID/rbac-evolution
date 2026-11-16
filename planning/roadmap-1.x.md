# 1.x roadmap candidates

Gaps found while writing the [use cases](../docs/use-cases/index.md). Each one is something a real app needs that the
library makes hard today. Additions only: none of them needs a breaking change, so they fit in 1.x minors.

| # | Gap | Today | Possible addition | Status |
| --- | --- | --- | --- | --- |
| 1 | Request helpers lose typed names | `req.rbac`, `request.rbac` and `c.var.rbac` are `SubjectRbac` even with `createRbac<AppRbac>()` | Make the middleware and module options generic over the engine | 1.1: `RbacRegister`, `RbacRequest<T>`, `RbacEnv<T>`, `getRbac<T>()` |
| 2 | Typed names are per engine, not per guard | A `web` permission compiles on an `api` route | Typed config keyed by guard | 1.2: `createRbac<{ guards: { ... } }>()`, `createGuards<T, 'api'>()` |
| 3 | No expiry on assignments | Temporary access needs an app table and a revoke job | `expiresAt` on roles and direct permissions | Open: needs a schema change, design first |
| 4 | No "remove from everything" | `syncRoles([])` plus `syncPermissions([])`, per guard and per team | `rbac.for(subject).revokeAll()` | 1.1: `revokeAll({ allGuards, allTeams })` |
| 5 | No way to delete a team | List members per role and clear each one | `rbac.deleteTeam(teamId)` | 1.1: `rbac.deleteTeam()` |
| 6 | No way to list a subject's teams | The app keeps its own membership table | `rbac.for(subject).teams()` | 1.1: `teams()` |
| 7 | `subjectsWithPermission` ignores wildcards | Loop over roles with `hasPermissionTo()` | Expand wildcards when `wildcard: true` | 1.1: `{ expandWildcards: true }` |
| 8 | A shorter wildcard name implies the longer ones | `orders.refund` covers `orders.refund.large` | Warning in `sync()` when a stored name is a prefix of another | 1.1: `wildcardPrefixCheck` |
| 9 | `before` hooks don't reach the UI | React/Vue show actions the server denies | Carry denied names in the snapshot | 1.1: `snapshot({ checkBefore })` → `denied` |
| 10 | Events don't say who made the change | Audit logs read the actor from AsyncLocalStorage | Optional `actor` in write options and event payloads | 1.1: `{ actor }` and `getActor` |
| 11 | An unknown role from user input is a 500 | Every app writes its own allow-list | `isRoleName()` / `isPermissionName()` type guards tied to the typed config | 1.1: `isRoleName()` / `isPermissionName()` with `names` |
