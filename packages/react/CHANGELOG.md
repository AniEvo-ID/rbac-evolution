# @anievo-id/rbac-evolution-react

## 1.8.0

### Patch Changes

- @anievo-id/rbac-evolution@1.8.0

## 1.7.0

### Patch Changes

- @anievo-id/rbac-evolution@1.7.0

## 1.6.0

### Patch Changes

- @anievo-id/rbac-evolution@1.6.0

## 1.5.0

### Patch Changes

- Updated dependencies [72e73a6]
  - @anievo-id/rbac-evolution@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies [38f3970]
  - @anievo-id/rbac-evolution@1.4.0

## 1.3.0

### Patch Changes

- @anievo-id/rbac-evolution@1.3.0

## 1.2.0

### Patch Changes

- Updated dependencies [54bbcc9]
- Updated dependencies [54bbcc9]
- Updated dependencies [54bbcc9]
  - @anievo-id/rbac-evolution@1.2.0

## 1.1.0

### Minor Changes

- 278d65a: Wildcard queries, a warning for prefix wildcards, `before` denials in the UI, and the actor in events. Everything is opt-in or additive: existing code gets the same results, payloads and snapshots as in 1.0.
  
  - **`subjectsWithPermission(type, names, { expandWildcards: true })`.** With `wildcard: true`, also returns the subjects whose granted permission is a wildcard that implies one of the names (`articles.*`, `articles`, `*` for `articles.edit`), directly or through a role. The names then don't need to exist as permissions. The default is still exact matching. New type: `SubjectsWithPermissionOptions`.
  - **Prefix wildcard check.** With `wildcard: true`, a shorter permission implies every longer one below it: `orders.refund` also grants `orders.refund.large`. `sync()` and `createPermission()` now report such pairs. The new `wildcardPrefixCheck` option chooses what happens: `'warn'` (default) logs a one-time `console.warn` per pair only when `NODE_ENV` is `development`, `'error'` throws an `RbacError` with code `INVALID_WILDCARD_PERMISSION` before anything is written (dry runs included), `'off'` disables it. New type: `WildcardPrefixCheck`.
  - **`before` denials in the snapshot.** `rbac.for(user).snapshot({ checkBefore: ['audit-log.delete'] })` runs the `before` hook for those names and lists the ones it denies in the new optional `RbacSnapshot.denied`. The React checker (`<RbacProvider>`, `useCan`, `<Can>`, `createRbacChecker`), the Vue state (`can`, `v-can`, `<Can>`, `$can`) and Next's `snapshotSatisfies` treat those names as not allowed, even for super-admins. Snapshots without `denied` behave as before. New type: `SnapshotOptions`.
  - **`actor` in events.** Write calls accept `actor` (`rbac.for(user, { actor })`, `rbac.role(name, { actor })`, `createRole`, `createPermission`, `deleteRole`, `deletePermission`, `findOrCreate*`, `sync(definition, { actor })`), and `createRbac({ getActor })` reads it from your request context (for example an `AsyncLocalStorage`) when a call passes none. Events then carry `actor`. Without either, payloads have no `actor` field, as before. New types: `RbacActor`, `ActorOptions`, `ActorResolver`, `RbacEventBase`.

### Patch Changes

- Updated dependencies [278d65a]
- Updated dependencies [278d65a]
- Updated dependencies [278d65a]
  - @anievo-id/rbac-evolution@1.1.0

## 1.0.0

### Patch Changes

- Updated dependencies [a69ebb9]
  - @anievo-id/rbac-evolution@1.0.0

## 1.0.0-rc.0

### Patch Changes

- Updated dependencies [a69ebb9]
  - @anievo-id/rbac-evolution@1.0.0-rc.0

## 0.9.0

### Minor Changes

- 990af7c: More of spatie/laravel-permission's API:

  - `rbac.for(user).hasAnyDirectPermission(...)` and `.hasAllDirectPermissions(...)`: direct permissions only, never throw.
  - `rbac.for(user).checkPermissionTo(name)`: `hasPermissionTo` that returns `false` instead of throwing for an unknown permission or another guard.
  - `rbac.for(user).withScope({ guard, team })`: the same subject in another guard or team, like passing the guard to a spatie check (`$user->hasRole('admin', 'api')`).
  - `rbac.findRoleById(id, { guard })` and `rbac.findPermissionById(id, { guard })`, like `Role::findById` and `Permission::findById`.
  - `rbac.rolesWithPermission(name, { guard, team })`: the roles that grant a permission, like `$permission->roles`.
  - React: `<UnlessRole role="banned">`, like `@unlessrole`.

### Patch Changes

- 990af7c: The npm README now follows the same short structure: install, example, link to the docs.
- Updated dependencies [990af7c]
- Updated dependencies [990af7c]
  - @anievo-id/rbac-evolution@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [3cc54d1]
  - @anievo-id/rbac-evolution@0.8.0

## 0.7.1

### Patch Changes

- 5bd0554: Options now accept an explicit `undefined` under TypeScript's `exactOptionalPropertyTypes`, with the same meaning as leaving the option out. Before, `rbac.for(user, { guard: process.env.GUARD })` or `rbacMiddleware({ rbac, getSubject, guard: maybeGuard })` failed to compile with that setting (TS2375/TS2379) although they worked at runtime, so the option had to be spread conditionally. Every optional option, prop and query field of every package is now declared `| undefined`.

  The `createGuards()` defaults of the Express, Fastify and Hono integrations now also treat `undefined` as "not set": `requireRole('admin', { onForbidden: undefined })` keeps the shared `onForbidden` instead of falling back to the built-in 403.

  Found by the new type tests, which now cover the public types of all 14 packages.

- Updated dependencies [5bd0554]
  - @anievo-id/rbac-evolution@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [71ce31d]
- Updated dependencies [3aca854]
- Updated dependencies [71ce31d]
  - @anievo-id/rbac-evolution@0.7.0

## 0.6.6

### Patch Changes

- @anievo-id/rbac-evolution@0.6.6

## 0.6.5

### Patch Changes

- 2a54f67: README links that pointed at sibling folders (`../core`, `../vue`, `../express`, `../../README.md`) and broke on npm now point to the GitHub repository and the npm package pages. No code changes.
  - @anievo-id/rbac-evolution@0.6.5

## 0.6.4

### Patch Changes

- d449204: Each package's npm page now links to its own page on the documentation site at https://creation.anievo.id/rbac-evolution/: the `homepage` field (shown as "Homepage" on npm) and a Documentation link at the top of the README. No code changes.
- Updated dependencies [d449204]
  - @anievo-id/rbac-evolution@0.6.4

## 0.6.3

### Patch Changes

- @anievo-id/rbac-evolution@0.6.3

## 0.6.2

### Patch Changes

- 70a7cf2: Fixes:

  - Core: two `role(...).syncSubjects()` calls running at the same time could remove each other's new holders and leave the role with none. Sync now only detaches holders it saw before attaching.
  - React: while `loading`, every checker method returns `false`, `cannot()` included (it returned `true`), and a stale snapshot passed with `loading` no longer grants anything. So `useCannot()` no longer shows "no access" UI before the snapshot arrives.

  Correction to the 0.6.0 notes: besides `requireRole(' | ')`, two more guards whose names are all blank used to answer 403 on every request and now throw a `TypeError` when they are defined: `requireRoleOrPermission(' ')` and `requirePermission('', { any: true })` (Express, Fastify, Hono). In Nuxt server helpers the same calls now reject with a `TypeError` (a 500) instead of a 403. They still never grant access. If names come from configuration, check them before building the guard.

- Updated dependencies [70a7cf2]
  - @anievo-id/rbac-evolution@0.6.2

## 0.6.1

### Patch Changes

- @anievo-id/rbac-evolution@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [7cef7cb]
  - @anievo-id/rbac-evolution@0.6.0

## 0.5.0

### Minor Changes

- e9f2c48: - React: `<RbacProvider loading>` and Vue: `createRbacPlugin({ loading: true })`. While the snapshot is still being fetched, `<Can>`, `<Cannot>`, `<HasRole>`, `v-can` and `v-role` render nothing (not even a fallback or a `not` branch), so "read-only" content no longer flashes before the real permissions arrive. Exposed as `useRbac().loading` / `rbac.loading.value`.
  - Adapter test suite (`runAdapterTests`): reverse lookups (`getSubjectIdsWithRoles` / `getSubjectIdsWithPermissions`) are now checked per team.

### Patch Changes

- Updated dependencies [e9f2c48]
  - @anievo-id/rbac-evolution@0.5.0

## 0.4.1

### Patch Changes

- @anievo-id/rbac-evolution@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [9f8a114]
- Updated dependencies [5812866]
- Updated dependencies [ed88963]
  - @anievo-id/rbac-evolution@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [a890bc2]
  - @anievo-id/rbac-evolution@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [b20a7cf]
  - @anievo-id/rbac-evolution@0.3.0

## 0.2.1

### Patch Changes

- f6c6b9b: Fixes found while writing the docs:

  - **core**: `VERSION` is now read from package.json (it still said `0.1.0`).
  - **core**: the "does this permission exist?" check in `can()` / `hasPermissionTo()` is now cached per guard (cleared on every change), so repeated checks no longer query the database.
  - **next**: `createRbacMiddleware` in `rbac` mode now checks through the engine, so `superAdminRoles` and the `before` hook apply just like in `requirePermission()`.
  - **next**: 401/403 JSON bodies now match the Express package: `{ error: 'UNAUTHENTICATED', message }` and `{ error: 'FORBIDDEN', reason, message }`. If you parse the old `'Unauthenticated'` / `'Forbidden'` values, update them.
  - **react**: `canAll()`, `hasAllRoles()`, `useCanAll()` and `<Can allOf={[]}>` now deny an empty list, like the Vue package.

- Updated dependencies [f6c6b9b]
  - @anievo-id/rbac-evolution@0.2.1

## 0.2.0

### Patch Changes

- @anievo-id/rbac-evolution@0.2.0

## 0.1.1

### Patch Changes

- 6b7fef7: Add `author`, `homepage`, `bugs` and `engines` metadata to every package, so npm links to the right README, issue tracker and supported Node.js versions. First release published through npm Trusted Publishing with provenance.
- Updated dependencies [6b7fef7]
  - @anievo-id/rbac-evolution@0.1.1

## 0.1.0

### Minor Changes

- 036fb78: Initial release of rbac-evolution — role & permission management for JS/TS, inspired by spatie/laravel-permission.

  - **core**: roles, permissions, direct permissions, guards, wildcard permissions, teams, caching, super-admin (`before` / `superAdminRoles`), events, typed names, subject queries, `MemoryAdapter` and an adapter conformance test-suite (`/testing`).
  - **prisma**: `PrismaAdapter` and a spatie-compatible Prisma schema.
  - **drizzle**: PostgreSQL & SQLite schemas and adapters, plus plain SQL DDL.
  - **react**: `RbacProvider`, `<Can>`, `<Cannot>`, `<HasRole>` and hooks.
  - **next**: server helpers, server action & route handler guards, and middleware.
  - **vue**: plugin, `v-can` / `v-role` directives, components and composables.
  - **express**: `rbacMiddleware`, `requirePermission`, `requireRole`, `requireRoleOrPermission`.

### Patch Changes

- Updated dependencies [036fb78]
  - @anievo-id/rbac-evolution@0.1.0
