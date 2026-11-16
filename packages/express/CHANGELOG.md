# @anievo-id/rbac-evolution-express

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

- 278d65a: Typed names reach the request's subject, and user input can be checked against them.
  
  - **Request helpers keep typed names.** The options of every integration are generic over the engine (`RbacMiddlewareOptions<T>`, `RbacPluginOptions<T>`, `RbacModuleOptions<T>`, ...) and infer `T` from `rbac`. Hono: `RbacVariables<T>` / `RbacEnv<T>` take the names type or `typeof rbac`, `rbacMiddleware({ rbac })` adds a typed `c.var.rbac`, and the guards of `createGuards<T>()` keep it typed after them. Express and Fastify type the request globally, so register the engine once (`declare module '@anievo-id/rbac-evolution-express' { interface RbacRegister { rbac: typeof rbac } }`, same for Fastify) or type a handler's request as `RbacRequest<typeof rbac>`. NestJS: `getRbac<T>(context)`, and `createRbacDecorators<typeof rbac>()` takes the engine type like `createGuards`. The `onUnauthenticated` / `onForbidden` handlers of `createGuards<T>()` get the typed request (`GuardRequest<T>`, `GuardHandlerContext<T>` in Hono). Without a type argument or a registration, every type is the same as in 1.0.
  - **`isRoleName(rbac, value)` / `isPermissionName(rbac, value)`**: type guards that check user input against the new `names` option of `createRbac()` (`names: { roles, permissions }`), and narrow it to `RoleName<T>` / `PermissionName<T>`. They check the list, not the database: exact names, no query. Without the list for that kind, they throw a `TypeError`.

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

- 802cab2: Guards take a `guard` option for one route, like spatie's `role:admin,api`: `requireRole('admin', { guard: 'api' })`, `@RequireRoles('admin', { guard: 'api' })`, and in Nuxt `requireRole(event, 'admin', { guard: 'api' })`. That check runs in the given guard; the request's own subject stays in its default guard. `requireRoleOrPermission`, `canAny` and `canAll` (and the matching NestJS decorators and Nuxt helpers) now take an options object too. Next.js already had it through `RequireOptions`.

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

- 7cef7cb: The framework integrations now share one requirement parser and checker from core (`permissionRequirement`, `roleRequirement`, `roleOrPermissionRequirement`, `satisfiesRequirement`, `splitRequirementArgs`, `REQUIREMENT_MESSAGES`), instead of five copies. Behaviour is unchanged, with one stricter case: in Express, Fastify and Hono, a role guard whose names are all blank (`requireRole(' | ')`) now throws a `TypeError` when it is defined, like NestJS and Nuxt already did, instead of answering 403 on every request.
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

### Minor Changes

- 5812866: spatie v8 parity:

  - `canAny()` / `canAll()` route guards in Express, Fastify and Hono, `@CanAny` / `@CanAll` decorators in NestJS, and `canAny` / `canAll` server helpers in Nuxt (spatie v8.5 route macros).
  - `rbac.role(name).syncSubjects(subjectType, ids)` makes the given subjects the role's only holders of that type (spatie `Role::syncModels()`).

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
