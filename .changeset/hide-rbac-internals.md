---
'@anievo-id/rbac-evolution': minor
---

`Rbac` no longer exposes its engine internals. The ten members marked `@internal` (`events`, `gate`, `permissionExists`, `permissionMatches`, `remember`, `resolveGuard`, `resolvePermissions`, `resolveRoles`, `resolveTeam`, `visibleTeams`) are now truly private, so they can't be called by accident and can change freely before 1.0. Nothing documented changes: listen to events with `rbac.on()` / `rbac.off()`, and check permissions through `rbac.for(subject)` and `rbac.role(name)`.

If your code called one of these members anyway, `rbac.defaultGuard`, `rbac.wildcard` and `rbac.teams` are still public, and `rbac.for(subject, { guard, team })` resolves guards and teams for you.
