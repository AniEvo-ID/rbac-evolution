# @anievo-id/rbac-evolution-nuxt

## 0.9.0

### Minor Changes

- 802cab2: Guards take a `guard` option for one route, like spatie's `role:admin,api`: `requireRole('admin', { guard: 'api' })`, `@RequireRoles('admin', { guard: 'api' })`, and in Nuxt `requireRole(event, 'admin', { guard: 'api' })`. That check runs in the given guard; the request's own subject stays in its default guard. `requireRoleOrPermission`, `canAny` and `canAll` (and the matching NestJS decorators and Nuxt helpers) now take an options object too. Next.js already had it through `RequireOptions`.

### Patch Changes

- 990af7c: The npm README now follows the same short structure: install, example, link to the docs.
- Updated dependencies [990af7c]
- Updated dependencies [990af7c]
  - @anievo-id/rbac-evolution@0.9.0
  - @anievo-id/rbac-evolution-vue@0.9.0

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
  - @anievo-id/rbac-evolution-vue@0.8.0

## 0.7.1

### Patch Changes

- 5bd0554: Options now accept an explicit `undefined` under TypeScript's `exactOptionalPropertyTypes`, with the same meaning as leaving the option out. Before, `rbac.for(user, { guard: process.env.GUARD })` or `rbacMiddleware({ rbac, getSubject, guard: maybeGuard })` failed to compile with that setting (TS2375/TS2379) although they worked at runtime, so the option had to be spread conditionally. Every optional option, prop and query field of every package is now declared `| undefined`.

  The `createGuards()` defaults of the Express, Fastify and Hono integrations now also treat `undefined` as "not set": `requireRole('admin', { onForbidden: undefined })` keeps the shared `onForbidden` instead of falling back to the built-in 403.

  Found by the new type tests, which now cover the public types of all 14 packages.

- Updated dependencies [5bd0554]
  - @anievo-id/rbac-evolution@0.7.1
  - @anievo-id/rbac-evolution-vue@0.7.1

## 0.7.0

### Patch Changes

- 71ce31d: Types now resolve under `moduleResolution: "node16"` / `"nodenext"`. The declaration files imported their siblings without a `.js` extension (`'./runtime/rule'`), which those settings can't resolve, so `RbacRouteRule`, `RouteRuleResult`, `NuxtRbac` and `RbacPublicConfig` silently became `any` and a wrong `rbac` route rule type-checked. Found by the new package lint (publint and arethetypeswrong) that now runs in CI.
- Updated dependencies [71ce31d]
- Updated dependencies [3aca854]
- Updated dependencies [71ce31d]
  - @anievo-id/rbac-evolution@0.7.0
  - @anievo-id/rbac-evolution-vue@0.7.0

## 0.6.6

### Patch Changes

- @anievo-id/rbac-evolution@0.6.6
- @anievo-id/rbac-evolution-vue@0.6.6

## 0.6.5

### Patch Changes

- 2a54f67: README links that pointed at sibling folders (`../core`, `../vue`, `../express`, `../../README.md`) and broke on npm now point to the GitHub repository and the npm package pages. No code changes.
- Updated dependencies [2a54f67]
  - @anievo-id/rbac-evolution-vue@0.6.5
  - @anievo-id/rbac-evolution@0.6.5

## 0.6.4

### Patch Changes

- d449204: Each package's npm page now links to its own page on the documentation site at https://creation.anievo.id/rbac-evolution/: the `homepage` field (shown as "Homepage" on npm) and a Documentation link at the top of the README. No code changes.
- Updated dependencies [d449204]
  - @anievo-id/rbac-evolution@0.6.4
  - @anievo-id/rbac-evolution-vue@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [ef494f0]
  - @anievo-id/rbac-evolution-vue@0.6.3
  - @anievo-id/rbac-evolution@0.6.3

## 0.6.2

### Patch Changes

- 70a7cf2: Fixes:

  - Core: two `role(...).syncSubjects()` calls running at the same time could remove each other's new holders and leave the role with none. Sync now only detaches holders it saw before attaching.
  - React: while `loading`, every checker method returns `false`, `cannot()` included (it returned `true`), and a stale snapshot passed with `loading` no longer grants anything. So `useCannot()` no longer shows "no access" UI before the snapshot arrives.

  Correction to the 0.6.0 notes: besides `requireRole(' | ')`, two more guards whose names are all blank used to answer 403 on every request and now throw a `TypeError` when they are defined: `requireRoleOrPermission(' ')` and `requirePermission('', { any: true })` (Express, Fastify, Hono). In Nuxt server helpers the same calls now reject with a `TypeError` (a 500) instead of a 403. They still never grant access. If names come from configuration, check them before building the guard.

- Updated dependencies [70a7cf2]
  - @anievo-id/rbac-evolution@0.6.2
  - @anievo-id/rbac-evolution-vue@0.6.2

## 0.6.1

### Patch Changes

- @anievo-id/rbac-evolution@0.6.1
- @anievo-id/rbac-evolution-vue@0.6.1

## 0.6.0

### Patch Changes

- 7cef7cb: The framework integrations now share one requirement parser and checker from core (`permissionRequirement`, `roleRequirement`, `roleOrPermissionRequirement`, `satisfiesRequirement`, `splitRequirementArgs`, `REQUIREMENT_MESSAGES`), instead of five copies. Behaviour is unchanged, with one stricter case: in Express, Fastify and Hono, a role guard whose names are all blank (`requireRole(' | ')`) now throws a `TypeError` when it is defined, like NestJS and Nuxt already did, instead of answering 403 on every request.
- Updated dependencies [7cef7cb]
  - @anievo-id/rbac-evolution@0.6.0
  - @anievo-id/rbac-evolution-vue@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [e9f2c48]
  - @anievo-id/rbac-evolution@0.5.0
  - @anievo-id/rbac-evolution-vue@0.5.0

## 0.4.1

### Patch Changes

- af8e6ac: Fixes:

  - Nuxt: each `createRbacServer()` caches its own subject per request, so a second helper (e.g. guard `api`) no longer reuses another guard's subject. The first helper to resolve still fills `event.context.rbac` for the client plugin.
  - Vue: `v-can` / `v-role` (and the state checks) treat an `undefined` or `null` value as an empty list and hide the element, instead of throwing and leaving it visible.
  - Prisma: the adapter works with an interactive-transaction client (`prisma.$transaction(async (tx) => …)`); deleting a role or permission no longer fails there.

- Updated dependencies [af8e6ac]
  - @anievo-id/rbac-evolution-vue@0.4.1
  - @anievo-id/rbac-evolution@0.4.1

## 0.4.0

### Minor Changes

- 5812866: spatie v8 parity:

  - `canAny()` / `canAll()` route guards in Express, Fastify and Hono, `@CanAny` / `@CanAll` decorators in NestJS, and `canAny` / `canAll` server helpers in Nuxt (spatie v8.5 route macros).
  - `rbac.role(name).syncSubjects(subjectType, ids)` makes the given subjects the role's only holders of that type (spatie `Role::syncModels()`).

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
  - @anievo-id/rbac-evolution-vue@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [a890bc2]
  - @anievo-id/rbac-evolution@0.3.1
  - @anievo-id/rbac-evolution-vue@0.3.1

## 0.3.0

### Minor Changes

- a4f9393: New framework integrations:

  - `@anievo-id/rbac-evolution-nestjs`: `RbacModule.forRoot()` / `forRootAsync()`, `RbacGuard`, `@RequirePermissions()`, `@RequireRoles()`, `@RequireRoleOrPermission()` and `@CurrentRbac()`, with the same semantics and 401/403 bodies as the Express package.
  - `@anievo-id/rbac-evolution-nuxt`: a Nuxt 3/4 module that installs the Vue integration, hydrates the snapshot from SSR, auto-imports `useRbac()` / `useCan()` & co., enforces `definePageMeta({ rbac })` with a route middleware, and provides `createRbacServer()` helpers for Nitro routes.

### Patch Changes

- Updated dependencies [b20a7cf]
  - @anievo-id/rbac-evolution@0.3.0
  - @anievo-id/rbac-evolution-vue@0.3.0
