# @anievo-id/rbac-evolution-cli

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

### Minor Changes

- ed88963: CLI and cache fixes:

  - **cli**: `sync --prune` now requires `--yes` (or `--dry-run` to preview), so a typo in `--file` can't delete every
    role and permission without asking. **Scripts that run `sync --prune` need to add `--yes`.**
  - **cli**: subject and team ids become numbers only when that is lossless. `9007199254740993` (beyond
    `Number.MAX_SAFE_INTEGER`) and `007` stay strings instead of silently pointing at another subject.
  - **core**: `MemoryCache` keeps at most `maxEntries` entries (default 10 000) and drops the oldest write when full,
    so a long-running process checking many different users no longer grows without bound. Configure it with
    `new MemoryCache({ maxEntries })`.

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

### Minor Changes

- b20a7cf: Add declarative seeding. Core: `rbac.sync(definition, { guard, team, prune, dryRun })` creates missing permissions and roles, syncs each role's permissions (`'*'` = every permission of the guard), optionally prunes what isn't declared, and returns a `{ created, updated, deleted }` summary (or the plan with `dryRun`). Supports multiple guards/teams via an array of definitions, typed names and the regular events; adds the `INVALID_SYNC_DEFINITION` error code. CLI: new `rbac-evolution sync [--prune] [--dry-run] [--file roles.json|.ts] [--json]` command reading `seed` from `rbac.config` (new `defineConfig` field) or a seed file.

### Patch Changes

- Updated dependencies [b20a7cf]
  - @anievo-id/rbac-evolution@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [f6c6b9b]
  - @anievo-id/rbac-evolution@0.2.1

## 0.2.0

### Minor Changes

- c7161a3: New package `@anievo-id/rbac-evolution-cli` — the equivalent of spatie's `php artisan permission:*` commands: `create-permission`, `create-role` (with `"a|b"` permissions), `assign-role`, `give-permission`, `show` (role × permission matrix, `--json`), `cache-reset` and `init`. Reads `rbac.config.ts` (TypeScript supported), supports `--guard`, `--team` and `--type`, and spatie-style names like `permission:create-role`.

### Patch Changes

- @anievo-id/rbac-evolution@0.2.0
