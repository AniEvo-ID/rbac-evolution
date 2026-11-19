# Versioning

RBAC Evolution follows [semantic versioning](https://semver.org). From 1.0 on, this page is the promise: what a
patch, minor or major release can change, what is supported, and how deprecations work.

## What each release can change

| Release | Can | Cannot |
| --- | --- | --- |
| **Patch** (`1.2.3` → `1.2.4`) | Fix bugs, docs and types that were wrong | Change working behaviour on purpose |
| **Minor** (`1.2` → `1.3`) | Add exports, options (with a default that keeps the old behaviour), optional adapter methods, support for new runtime or framework versions | Remove or rename anything, change a default |
| **Major** (`1.x` → `2.0`) | Anything above, listed in the upgrade guide | — |

Some details:

- **Security fixes are patches**, even when a check that wrongly allowed now denies. A fix that makes a check allow
  where it wrongly denied is a patch too, and is called out in the changelog.
- **All packages share one version number.** `1.x` of one package works with `1.x` of every other.
- **Types are public API.** A type change that breaks correct code is a major change. Types that only describe code
  that already failed at runtime can be tightened in a minor (for example, a guard called with no names).
- **Not covered:** members marked `@internal`, unexported types, the exact wording of error messages, and anything
  under a `/testing` entry point beyond `runAdapterTests`.

## What 1.0 freezes

These only change in a major release:

- Every export of every package. The list is checked in CI against `etc/*.api.md`, so any change shows up in review.
- The `RbacErrorCode` values: `PERMISSION_DOES_NOT_EXIST`, `PERMISSION_ALREADY_EXISTS`, `ROLE_DOES_NOT_EXIST`,
  `ROLE_ALREADY_EXISTS`, `GUARD_DOES_NOT_MATCH`, `TEAM_DOES_NOT_MATCH`, `TEAMS_NOT_ENABLED`, `INVALID_NAME`,
  `INVALID_WILDCARD_PERMISSION`, `INVALID_SYNC_DEFINITION`. New codes can be added in a minor.
- The 401/403 JSON body of the integrations: `error`, `reason`, `message`, and `required` (only with
  `exposeRequirements: true`).
- The event names (`role.attached`, `role.detached`, `permission.attached`, `permission.detached`, `role.created`,
  `role.deleted`, `permission.created`, `permission.deleted`) and their payload fields. New fields can be added in a
  minor.
- The defaults: cache on with `MemoryCache` (10 000 entries) and a 1-day TTL, `wildcard: false`, `teams: false`,
  default guard `web`.
- The naming of guards and options, which follows spatie:
  - `requirePermission` / `requireRole` / `requireRoleOrPermission` in every integration. NestJS uses decorators in
    the plural (`@RequirePermissions`, `@RequireRoles`), as Nest decorators usually are.
  - Permission guards take `{ any: true }` (default: all of them); role guards take `{ all: true }` (default: any of
    them), like spatie's middleware.
  - `hasRole` and `hasAnyRole` are both kept, as in spatie.

## Custom adapters

`RbacAdapter` is the contract for your own storage. In 1.x:

- New methods are **optional**, with a fallback in the engine, so existing adapters keep working.
- A new **required** method is a major change.
- The conformance suite (`runAdapterTests`) can gain tests in a minor. They only check behaviour the contract
  already describes, such as exact name matching, so a correct adapter keeps passing.

## Support

| Area | Supported in 1.x |
| --- | --- |
| Node.js | 20, 22, 24 |
| Bun | latest |
| Deno | not supported |
| PostgreSQL | 13+ |
| MySQL / MariaDB | 8 / 10.6+ |
| SQLite | 3.35+ |
| SQL Server | 2019+ |
| MongoDB | 6+ |
| TypeScript | 5.0+, with `moduleResolution` set to `node16`, `nodenext` or `bundler` |

| Framework or ORM | Supported in 1.x |
| --- | --- |
| Express | 4, 5 |
| Fastify | 5 |
| Hono | 4 |
| Elysia | 1.2+ |
| Next.js | 14, 15, 16 |
| Nuxt | 3, 4 |
| NestJS | 10, 11, 12 |
| tRPC | 11 |
| React | 18, 19 |
| Vue | 3.3+ |
| SvelteKit | 2, 3 (with Svelte 5) |
| TanStack Start | 1.x (React and Solid) |
| Prisma | 5.12+, 6, 7 |
| Drizzle ORM | 0.38+ |
| Kysely | 0.28, 0.29 (Node.js 22+ and TypeScript 5.4+, Kysely's own minimums) |
| Mongoose | 8, 9 (9 needs Node.js 20.19+) |

These match each package's `peerDependencies`. CI tests the oldest and the newest supported version of each one (the
`peers` job). See the [test report](/quality).

TypeScript's legacy `moduleResolution: "node"` (node10) ignores the `exports` field. The main entry point of each
package still resolves there, but subpaths such as `/testing`, `/pg` or `/middleware` don't. It is not supported.

### When support changes

- **Dropping a Node.js version is a major change.**
- **Raising the minimum version of a peer dependency is a major change**, unless that version has reached its end of
  life upstream. Then it can happen in a minor, with a note in the changelog.
- **Adding support** for a new Node.js, database or framework version is a minor change.

## Deprecations

- A deprecated API keeps working for **at least one minor release**. It is removed only in the next major.
- It is marked `@deprecated` in the types (your editor strikes it through), and logs a one-time warning when
  `NODE_ENV` is `development`.
- Every deprecation is listed in the changelog and in the [upgrade guide](/guide/upgrading).

## Docs for older versions

These docs follow the latest release. The docs of the last 0.x release (0.9.0) stay online, frozen, at
[/rbac-evolution/0.x/](https://creation.anievo.id/rbac-evolution/0.x/) (also under **Versions** in the top bar). They
are built from that release's own sources and are not updated: read the [upgrade guide](./upgrading) to move to 1.x.

## Security fixes

The latest 1.x minor gets security fixes. After 1.0 ships, 0.x gets fixes for critical issues for three months. See
the [security policy](https://github.com/AniEvo-ID/rbac-evolution/blob/main/SECURITY.md).
