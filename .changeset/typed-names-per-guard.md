---
'@anievo-id/rbac-evolution': minor
'@anievo-id/rbac-evolution-express': minor
'@anievo-id/rbac-evolution-fastify': minor
'@anievo-id/rbac-evolution-hono': minor
'@anievo-id/rbac-evolution-nestjs': minor
'@anievo-id/rbac-evolution-next': minor
'@anievo-id/rbac-evolution-nuxt': minor
'@anievo-id/rbac-evolution-cli': minor
---

Typed names per guard: a permission that only exists in `api` is a type error on a `web` subject or route.

- **Type config.** `createRbac<{ guards: { web: { roles; permissions }; api: { roles; permissions } }; defaultGuard: 'web' }>()` types the names of each guard (`RbacTypeConfig` gains the optional `guards` and `defaultGuard` keys). `rbac.for(user)` takes the default guard's names; `rbac.for(key, { guard: 'api' })`, `.withScope({ guard })`, `rbac.role(name, { guard })`, `createRole` / `createPermission` / `find*` / `delete*` / `subjectsWith*` with `{ guard }` take that guard's names, and `sync()` checks each block against its own `guard`. A non-literal `guard` accepts the names of every guard; an unknown literal is a type error. New types: `GuardName<T>`, `DefaultGuardName<T>`, `CheckGuard<T, G>`, `ScopedGuardName<T, G>`, `RbacGuardTypes`, `SyncDefinitions<T, G>`, `GuardSyncDefinition<T, G>`, `RbacGuardNames<T, G>`, and for the integrations `RequirementName<T, K, G>`, `RequirementGuard<A, G>`, `GuardRequirementArgs<A, T, K, G, O>`, `CheckRequirementGuard<T, G>`, `UnknownGuardName<G>`. `PermissionName`, `RoleName`, `SubjectRbac`, `RoleRbac`, `GuardOptions`, `ScopeOptions`, `SyncOptions`, `SyncDefinition`, `SnapshotOptions` and `SubjectsWithPermissionOptions` take an optional guard type argument.
- **`isRoleName()` / `isPermissionName()`** take `{ guard }` and check the list of that guard, from the new `names.guards` option (`names: { guards: { api: { permissions } } }`); a guard without a list uses `names.roles` / `names.permissions`.
- **Integrations.** `createGuards<AppRbac, 'api'>()` (Express, Fastify, Hono) and `createRbacDecorators<AppRbac, 'api'>()` (NestJS) check names in the guard of the request, and a route's `{ guard }` option takes the names of that guard. They return the new `ScopedGuards` / `ScopedRbacDecorators` for a per-guard config, and the 1.1 `Guards` / `RbacDecorators` otherwise (`GuardsFor`, `RbacDecoratorsFor`). `RbacRequest<T, Req, G>` (Express, Fastify), `RbacVariables<T, G>` / `RbacEnv<T, G>` (Hono, inferred from `rbacMiddleware({ guard })`), `getRbac<T, G>()` (NestJS) type the request's subject for a guard. Next.js: `createNextRbac({ rbac, guard })` returns a `ScopedNextRbac` whose helpers take `{ guard }` per call. Nuxt: `createRbacServer({ rbac, guard })` returns a `ScopedRbacServer` whose helpers return the subject typed for the guard they checked in. CLI: `seed` is checked block by block.

Flat configs (`{ roles; permissions }`) and untyped engines are unchanged: their types resolve to the 1.1 ones. No runtime change, except `names.guards` for the type guards.
