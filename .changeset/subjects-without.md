---
'@anievo-id/rbac-evolution': minor
---

Add `rbac.subjectsWithoutRole(type, roles, { among })` and `rbac.subjectsWithoutPermission(type, permissions, { among })`, the equivalents of spatie's `User::withoutRole()` and `User::withoutPermission()`. They return the ids of `among` that have none of the given roles or permissions, in the order of `among`, with the same scope (`guard`, `team`), options (`expandWildcards`) and errors as `subjectsWithRole()` / `subjectsWithPermission()`. Expired assignments don't count. No adapter changes: every adapter supports them.
