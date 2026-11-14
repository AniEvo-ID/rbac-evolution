# @anievo-id/rbac-evolution-nuxt

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
