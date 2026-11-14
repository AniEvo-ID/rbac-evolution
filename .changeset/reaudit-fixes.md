---
'@anievo-id/rbac-evolution': patch
'@anievo-id/rbac-evolution-react': patch
'@anievo-id/rbac-evolution-express': patch
'@anievo-id/rbac-evolution-fastify': patch
'@anievo-id/rbac-evolution-hono': patch
'@anievo-id/rbac-evolution-nuxt': patch
---

Fixes:

- Core: two `role(...).syncSubjects()` calls running at the same time could remove each other's new holders and leave the role with none. Sync now only detaches holders it saw before attaching.
- React: while `loading`, every checker method returns `false`, `cannot()` included (it returned `true`), and a stale snapshot passed with `loading` no longer grants anything. So `useCannot()` no longer shows "no access" UI before the snapshot arrives.

Correction to the 0.6.0 notes: besides `requireRole(' | ')`, two more guards whose names are all blank used to answer 403 on every request and now throw a `TypeError` when they are defined: `requireRoleOrPermission(' ')` and `requirePermission('', { any: true })` (Express, Fastify, Hono). In Nuxt server helpers the same calls now reject with a `TypeError` (a 500) instead of a 403. They still never grant access. If names come from configuration, check them before building the guard.
