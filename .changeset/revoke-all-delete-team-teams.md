---
'@anievo-id/rbac-evolution': minor
'@anievo-id/rbac-evolution-prisma': minor
'@anievo-id/rbac-evolution-drizzle': minor
'@anievo-id/rbac-evolution-kysely': minor
'@anievo-id/rbac-evolution-mongoose': minor
---

Remove a subject from everything, delete a team, and list a subject's teams.

- `rbac.for(subject).revokeAll(options?)` removes every role and direct permission of the subject in the current
  guard and team (`syncRoles([])` plus `syncPermissions([])` in one call). `{ allGuards: true }` and
  `{ allTeams: true }` widen it; both together remove the subject from everything, like spatie does when a model
  is deleted. Emits `role.detached` / `permission.detached` per team and guard.
- `rbac.deleteTeam(teamId)` removes every role and direct permission held in the team (any subject, any guard) and
  every role scoped to the team. Emits `role.detached` / `permission.detached` per subject and guard, then
  `role.deleted` per team role, and clears the cache. Throws `TEAMS_NOT_ENABLED` without `teams: true`.
- `rbac.for(subject).teams(options?)` returns the ids of the teams where the subject has a role or a direct
  permission (current guard, or every guard with `{ allGuards: true }`). Cached like other lookups.
- `RbacAdapter` gets three **optional** methods: `getSubjectLinks(subject)`, `getTeamLinks(teamId)` and
  `detachTeamLinks(teamId)`, with the `SubjectLinks`, `SubjectRoleLink` and `SubjectPermissionLink` types. Existing
  custom adapters keep working: `revokeAll()` in the current team only needs the required methods, `deleteTeam()`
  falls back to per-subject detaches without `detachTeamLinks`, and the calls that need `getSubjectLinks` or
  `getTeamLinks` throw an `RbacError` with the new code `ADAPTER_METHOD_MISSING` (before writing anything).
- Every built-in adapter (memory, Prisma, Drizzle, Kysely, Mongoose) implements the three methods, with the same
  exact matching of subject and team ids as the other methods, whatever the database collation.
- The conformance suite (`runAdapterTests`) tests the optional methods an adapter has, and skips the others.
- The engine no longer ends up in client bundles that only use `wildcardImplies` (React, Vue, the Next.js
  middleware): a `static {}` block kept bundlers from tree-shaking it. Those bundles shrink by about 4.5 kB
  (minified and brotlied).
