---
'@anievo-id/rbac-evolution-better-auth': minor
---

New package `@anievo-id/rbac-evolution-better-auth`, a Better Auth 1.4+ plugin. `rbacPlugin({ rbac, defaultRoles?, revokeOnDelete?, subjectType?, guard? })` adds `GET /rbac/snapshot` for the signed-in user, assigns `defaultRoles` when Better Auth creates a user, and removes a deleted user's roles and direct permissions in every team. `rbacClient()` (from `/client`) gives `authClient.rbac.snapshot()` for `<RbacProvider>`. `subjectFromSession(auth, headers)` turns a request's session into a subject for the `getSubject` of any integration. The plugin adds no columns to Better Auth's tables.
