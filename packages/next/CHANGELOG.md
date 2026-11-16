# @anievo-id/rbac-evolution-next

## 1.3.0

### Patch Changes

- @anievo-id/rbac-evolution@1.3.0

## 1.2.0

### Minor Changes

- 54bbcc9: Typed names per guard: a permission that only exists in `api` is a type error on a `web` subject or route.
  
  - **Type config.** `createRbac<{ guards: { web: { roles; permissions }; api: { roles; permissions } }; defaultGuard: 'web' }>()` types the names of each guard (`RbacTypeConfig` gains the optional `guards` and `defaultGuard` keys). `rbac.for(user)` takes the default guard's names; `rbac.for(key, { guard: 'api' })`, `.withScope({ guard })`, `rbac.role(name, { guard })`, `createRole` / `createPermission` / `find*` / `delete*` / `subjectsWith*` with `{ guard }` take that guard's names, and `sync()` checks each block against its own `guard`. A non-literal `guard` accepts the names of every guard; an unknown literal is a type error. New types: `GuardName<T>`, `DefaultGuardName<T>`, `CheckGuard<T, G>`, `ScopedGuardName<T, G>`, `RbacGuardTypes`, `SyncDefinitions<T, G>`, `GuardSyncDefinition<T, G>`, `RbacGuardNames<T, G>`, and for the integrations `RequirementName<T, K, G>`, `RequirementGuard<A, G>`, `GuardRequirementArgs<A, T, K, G, O>`, `CheckRequirementGuard<T, G>`, `UnknownGuardName<G>`. `PermissionName`, `RoleName`, `SubjectRbac`, `RoleRbac`, `GuardOptions`, `ScopeOptions`, `SyncOptions`, `SyncDefinition`, `SnapshotOptions` and `SubjectsWithPermissionOptions` take an optional guard type argument.
  - **`isRoleName()` / `isPermissionName()`** take `{ guard }` and check the list of that guard, from the new `names.guards` option (`names: { guards: { api: { permissions } } }`); a guard without a list uses `names.roles` / `names.permissions`.
  - **Integrations.** `createGuards<AppRbac, 'api'>()` (Express, Fastify, Hono) and `createRbacDecorators<AppRbac, 'api'>()` (NestJS) check names in the guard of the request, and a route's `{ guard }` option takes the names of that guard. They return the new `ScopedGuards` / `ScopedRbacDecorators` for a per-guard config, and the 1.1 `Guards` / `RbacDecorators` otherwise (`GuardsFor`, `RbacDecoratorsFor`). `RbacRequest<T, Req, G>` (Express, Fastify), `RbacVariables<T, G>` / `RbacEnv<T, G>` (Hono, inferred from `rbacMiddleware({ guard })`), `getRbac<T, G>()` (NestJS) type the request's subject for a guard. Next.js: `createNextRbac({ rbac, guard })` returns a `ScopedNextRbac` whose helpers take `{ guard }` per call. Nuxt: `createRbacServer({ rbac, guard })` returns a `ScopedRbacServer` whose helpers return the subject typed for the guard they checked in. CLI: `seed` is checked block by block.
  
  Flat configs (`{ roles; permissions }`) and untyped engines are unchanged: their types resolve to the 1.1 ones. No runtime change, except `names.guards` for the type guards.

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

### Patch Changes

- 990af7c: The npm README now follows the same short structure: install, example, link to the docs.
- Updated dependencies [990af7c]
- Updated dependencies [990af7c]
  - @anievo-id/rbac-evolution@0.9.0

## 0.8.0

### Minor Changes

- 3cc54d1: Typed names now reach the integrations. With `createRbac<AppTypes>()`, a typo in a guard, a server helper or the CLI seed is a type error. Pipe lists like `'edit articles|delete articles'` are checked part by part, and the error names the wrong part (`UnknownRequirementName<"delete artcles">`).

  - **Express, Fastify, Hono:** `createGuards<AppTypes>()` or `createGuards<typeof rbac>()`.
  - **NestJS:** `createRbacDecorators<AppTypes>()` returns typed `RequirePermissions`, `RequireRoles`, `RequireRoleOrPermission`, `CanAny` and `CanAll`.
  - **Next.js:** `createNextRbac({ rbac })` takes the names from the engine you pass in.
  - **Nuxt:** `createRbacServer({ rbac })` takes the names from the engine you pass in. With an explicit event type, pass both: `createRbacServer<MyEvent, AppTypes>()`.
  - **CLI:** `defineConfig({ rbac, seed })` checks `seed` against the engine.
  - **Core:** exports `RequirementArgs`, `CheckRequirementName` and their error types, so custom integrations can do the same.

  The guards and decorators exported directly still accept any string. A guard called with no names, with only options, or with options before a name is now a type error everywhere, because it threw or ignored the options at runtime. Fix such calls, or move the options last.

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

### Patch Changes

- Updated dependencies [e9f2c48]
  - @anievo-id/rbac-evolution@0.5.0

## 0.4.1

### Patch Changes

- @anievo-id/rbac-evolution@0.4.1

## 0.4.0

### Patch Changes

- e0454d1: Guard fixes and spatie v8.5 `canAll()` semantics:

  - **next**: `'a|b'` strings are split into "any of" (they were looked up as one name and always denied), in
    `requirePermission`, `requireRole`, `withRbac`, server actions and middleware rules, including snapshot mode.
  - **next**: new `all: true` option (requirement, `requirePermission` / `requireRole` options, middleware rules)
    requires every listed permission or role, like spatie v8.5's `canAll()`; arrays still mean "any of" by default.
  - **next**: middleware rules also match the percent-decoded path (`/%61dmin` is covered by `/admin`), and `RegExp`
    matchers with the `g` / `y` flag no longer flip between requests.
  - **nuxt**: a page rule whose `permission`, `role` or `roleOrPermission` key is present but `undefined` now fails
    closed (401 for guests, 403 otherwise) instead of letting everyone in.

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
