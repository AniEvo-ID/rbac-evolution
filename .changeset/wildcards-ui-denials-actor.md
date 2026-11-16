---
'@anievo-id/rbac-evolution': minor
'@anievo-id/rbac-evolution-react': minor
'@anievo-id/rbac-evolution-vue': minor
'@anievo-id/rbac-evolution-next': minor
---

Wildcard queries, a warning for prefix wildcards, `before` denials in the UI, and the actor in events. Everything is opt-in or additive: existing code gets the same results, payloads and snapshots as in 1.0.

- **`subjectsWithPermission(type, names, { expandWildcards: true })`.** With `wildcard: true`, also returns the subjects whose granted permission is a wildcard that implies one of the names (`articles.*`, `articles`, `*` for `articles.edit`), directly or through a role. The names then don't need to exist as permissions. The default is still exact matching. New type: `SubjectsWithPermissionOptions`.
- **Prefix wildcard check.** With `wildcard: true`, a shorter permission implies every longer one below it: `orders.refund` also grants `orders.refund.large`. `sync()` and `createPermission()` now report such pairs. The new `wildcardPrefixCheck` option chooses what happens: `'warn'` (default) logs a one-time `console.warn` per pair only when `NODE_ENV` is `development`, `'error'` throws an `RbacError` with code `INVALID_WILDCARD_PERMISSION` before anything is written (dry runs included), `'off'` disables it. New type: `WildcardPrefixCheck`.
- **`before` denials in the snapshot.** `rbac.for(user).snapshot({ checkBefore: ['audit-log.delete'] })` runs the `before` hook for those names and lists the ones it denies in the new optional `RbacSnapshot.denied`. The React checker (`<RbacProvider>`, `useCan`, `<Can>`, `createRbacChecker`), the Vue state (`can`, `v-can`, `<Can>`, `$can`) and Next's `snapshotSatisfies` treat those names as not allowed, even for super-admins. Snapshots without `denied` behave as before. New type: `SnapshotOptions`.
- **`actor` in events.** Write calls accept `actor` (`rbac.for(user, { actor })`, `rbac.role(name, { actor })`, `createRole`, `createPermission`, `deleteRole`, `deletePermission`, `findOrCreate*`, `sync(definition, { actor })`), and `createRbac({ getActor })` reads it from your request context (for example an `AsyncLocalStorage`) when a call passes none. Events then carry `actor`. Without either, payloads have no `actor` field, as before. New types: `RbacActor`, `ActorOptions`, `ActorResolver`, `RbacEventBase`.
