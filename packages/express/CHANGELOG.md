# @anievo-id/rbac-evolution-express

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
