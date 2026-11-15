# 1. API freeze

Goal: every export that will exist in 1.0 is one we are willing to support for years. Anything else is renamed,
made internal or removed **before** 1.0, while breaking changes are still cheap.

## Inventory

Generate the list of public exports per package and review it in one pull request.

- [ ] Script `scripts/list-exports.mjs`: for each package, list every export of every `exports` entry (values and types)
- [ ] Commit the output as `planning/api-inventory.md` and mark each export: **keep**, **rename**, **internal**, **remove**

Entry points today (from `package.json` `exports`):

| Package | Entry points |
| --- | --- |
| core | 3 (main, `/testing`, `package.json`) |
| drizzle | 8 (one per dialect schema) |
| next | 3 (server, middleware, `package.json`) |
| nuxt | 4 (module, server, runtime) |
| the other 10 | 2 each |

## Questions to settle

- [ ] **`@internal` members that are reachable.** `Rbac` has 10 members marked `@internal` that are still public on the class (`events`, `gate`, `permissionMatches`, `resolveGuard`, `resolveTeam`, `visibleTeams`, `resolveRoles`, `resolvePermissions`, ...). Make them truly private (`#`) or move them behind an internal module, so users can't depend on them.
- [ ] **Requirement helpers in core** (`permissionRequirement`, `satisfiesRequirement`, ...), added in 0.6. Keep them public, or move them to `@anievo-id/rbac-evolution/integration`, so the main entry stays small?
- [ ] **Naming consistency** across integrations: `requirePermission` (Express, Fastify, Hono, Nuxt, Next), `@RequirePermissions` (NestJS, plural), `withRbac` (Next). Decide whether the plural is intentional (Nest convention) and document it.
- [ ] **Option names**: `any` on permission guards and `all` on role guards. Keep the spatie-like asymmetry, but document it in one place.
- [ ] **Error codes**: freeze the list of `RbacErrorCode` values and the 401/403 JSON body shape (`error`, `reason`, `message`, `required`) as public API.
- [ ] **Events**: freeze the event names and payload fields.
- [ ] **Adapter interface (`RbacAdapter`)**: this is the contract for custom adapters. Freeze it, or label it "may gain methods in minor versions" (methods are added with a default where possible).
- [ ] **Kysely SQL Server**: now tested in CI (0.6.6). Drop the "Experimental" label, or keep it and exclude it from the 1.0 promise.
- [ ] **Deprecated or legacy aliases**: grep for aliases kept for compatibility (for example `hasRole` = `hasAnyRole`) and decide which stay.
- [ ] **Default values** that would be breaking to change later: cache TTL (1 day), `MemoryCache` `maxEntries` (10 000), `wildcard: false`, `teams: false`.

## Done when

- [ ] Every export in `api-inventory.md` is marked **keep**
- [ ] Every rename or removal shipped in a 0.x minor release, with a deprecation note one release earlier where possible
- [ ] An API snapshot is checked in CI (see [03-quality-gates.md](./03-quality-gates.md)) so later changes are visible in review
