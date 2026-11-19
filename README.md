<p align="center">
  <img src="docs/public/brand/logo.png" alt="RBAC Evolution logo" width="180">
</p>

<h1 align="center">RBAC Evolution</h1>

<p align="center">
  <b>Roles &amp; permissions for JavaScript and TypeScript, the <a href="https://github.com/spatie/laravel-permission">spatie/laravel-permission</a> way.</b><br>
  One typed core for Node.js and Bun, every framework, every database.
</p>

<p align="center">
  <a href="https://github.com/AniEvo-ID/rbac-evolution/actions/workflows/ci.yml"><img src="https://github.com/AniEvo-ID/rbac-evolution/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@anievo-id/rbac-evolution"><img src="https://img.shields.io/npm/v/@anievo-id/rbac-evolution?color=3b82f6&label=npm" alt="npm"></a>
  <a href="https://creation.anievo.id/rbac-evolution/quality"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fcreation.anievo.id%2Frbac-evolution%2Freports%2Funit.json&query=%24.totals.passed&suffix=%20passed&label=tests&color=00c896" alt="tests"></a>
  <a href="https://creation.anievo.id/rbac-evolution/quality"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fcreation.anievo.id%2Frbac-evolution%2Freports%2Fe2e.json&query=%24.totals.passed&suffix=%20passed&label=e2e&color=00c896" alt="e2e"></a>
  <a href="https://github.com/AniEvo-ID/rbac-evolution/actions/workflows/release-check.yml"><img src="https://github.com/AniEvo-ID/rbac-evolution/actions/workflows/release-check.yml/badge.svg" alt="release sync"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/AniEvo-ID/rbac-evolution"><img src="https://api.scorecard.dev/projects/github.com/AniEvo-ID/rbac-evolution/badge" alt="OpenSSF Scorecard"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license"></a>
</p>

<p align="center">
  📖 <a href="https://creation.anievo.id/rbac-evolution/"><b>Documentation</b></a> ·
  🧪 <a href="https://creation.anievo.id/rbac-evolution/quality">Test report</a> ·
  🚀 <a href="https://creation.anievo.id/rbac-evolution/guide/quick-start">Quick start</a> ·
  ✨ <a href="https://creation.anievo.id/rbac-evolution/guide/whats-new">What's new</a>
</p>

> **Status: ✅ stable (1.0).** The public API only changes in a breaking way in a new major version. Every release is
> tested against real PostgreSQL, MySQL, SQL Server and MongoDB servers, the oldest and newest supported framework
> versions, end-to-end in a browser, and on Node.js 20, 22, 24 and Bun. See [versioning](https://creation.anievo.id/rbac-evolution/guide/versioning).

## Meet the Sect

The docs are guarded by nine original chibi characters. Each one looks after a part of the library.

<table align="center">
  <tr>
    <td align="center" width="110"><a href="https://creation.anievo.id/rbac-evolution/basic-usage/super-admin"><img src="docs/public/mascots/sect-master.webp" height="110" alt="Yue, the Sect Master"><br><b>Yue</b></a><br><sub>Super-admin</sub></td>
    <td align="center" width="110"><a href="https://creation.anievo.id/rbac-evolution/frameworks/express"><img src="docs/public/mascots/gatekeeper.webp" height="110" alt="Rin, the Blade Gatekeeper"><br><b>Rin</b></a><br><sub>Guards</sub></td>
    <td align="center" width="110"><a href="https://creation.anievo.id/rbac-evolution/basic-usage/direct-permissions"><img src="docs/public/mascots/scroll-keeper.webp" height="110" alt="Mei, the Scroll Keeper"><br><b>Mei</b></a><br><sub>Permissions</sub></td>
    <td align="center" width="110"><a href="https://creation.anievo.id/rbac-evolution/basic-usage/teams"><img src="docs/public/mascots/twins.webp" height="110" alt="Hana and Sora, the Branch Twins"><br><b>Hana &amp; Sora</b></a><br><sub>Teams</sub></td>
    <td align="center" width="110"><a href="https://creation.anievo.id/rbac-evolution/guide/quick-start"><img src="docs/public/mascots/disciple.webp" height="110" alt="Tao, the New Disciple"><br><b>Tao</b></a><br><sub>Quick start</sub></td>
  </tr>
  <tr>
    <td align="center" width="110"><a href="https://creation.anievo.id/rbac-evolution/adapters/overview"><img src="docs/public/mascots/weaver.webp" height="110" alt="Lan, the Formation Weaver"><br><b>Lan</b></a><br><sub>Adapters</sub></td>
    <td align="center" width="110"><a href="https://creation.anievo.id/rbac-evolution/advanced/cache"><img src="docs/public/mascots/alchemist.webp" height="110" alt="Xia, the Pill Alchemist"><br><b>Xia</b></a><br><sub>Cache</sub></td>
    <td align="center" width="110"><a href="https://creation.anievo.id/rbac-evolution/advanced/events"><img src="docs/public/mascots/messenger.webp" height="110" alt="Feng, the Spirit Messenger"><br><b>Feng</b></a><br><sub>Events</sub></td>
    <td align="center" width="110"><a href="https://creation.anievo.id/rbac-evolution/guide/introduction"><img src="docs/public/mascots/spirit-fox.webp" height="110" alt="Kitsu, the Spirit Fox"><br><b>Kitsu</b></a><br><sub>Hints</sub></td>
    <td align="center" width="110"><a href="https://creation.anievo.id/rbac-evolution/"><img src="docs/public/mascots/sect-master-3d.webp" height="110" alt="Yue as a 3D figure"><br><b>3D</b></a><br><sub>Every guardian has a 3D form</sub></td>
  </tr>
</table>

## Quick start

```bash
npm i @anievo-id/rbac-evolution
```

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

const rbac = createRbac({ adapter: new MemoryAdapter() })

await rbac.createPermission('edit articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

const user = rbac.for({ type: 'user', id: 1 })
await user.assignRole('writer')

await user.hasRole('writer') // true
await user.can('edit articles') // true
```

Then pick an adapter for your database and an integration for your framework, for example Express:

```ts
import { rbacMiddleware, requirePermission } from '@anievo-id/rbac-evolution-express'

app.use(rbacMiddleware({ rbac, getSubject: (req) => (req.user ? { type: 'user', id: req.user.id } : null) }))
app.put('/articles/:id', requirePermission('edit articles'), handler) // 401 for guests, 403 without access
```

> ⚠️ Client-side checks (React, Vue, Solid) only decide what the UI shows. Always enforce permissions on the server.

## Coming from spatie/laravel-permission v8

The API follows [spatie/laravel-permission](https://spatie.be/docs/laravel-permission/v8/introduction) v8
(November 2026). If you know it, you already know this package:
[side-by-side mapping](https://creation.anievo.id/rbac-evolution/guide/coming-from-laravel).

| spatie/laravel-permission v8 | RBAC Evolution |
| --- | --- |
| `assignRole`, `givePermissionTo`, `hasRole`, `can`, `syncRoles`, `syncPermissions` | ✅ same names on `rbac.for(user)` |
| Direct permissions, permissions via roles | ✅ |
| Multiple guards (`web`, `api`) | ✅ |
| Wildcard permissions (`articles.*`) | ✅ |
| Teams | ✅ |
| Super-admin with `Gate::before` | ✅ `superAdminRoles` and a `before()` hook |
| Events (`RoleAttachedEvent`, … including detach events on sync, v8.2) | ✅ `role.attached`, `permission.detached`, … |
| Cache and `permission:cache-reset` | ✅ pluggable cache store, `rbac-evolution cache-reset` |
| Artisan `permission:create-role`, `create-permission`, `assign-role`, `show` | ✅ [CLI](https://creation.anievo.id/rbac-evolution/basic-usage/cli) with the same commands |
| Database seeding | ✅ declarative `rbac.sync()` / `rbac-evolution sync` |
| `User::role('writer')`, `User::permission('edit')` | ✅ `subjectsWithRole()`, `subjectsWithPermission()` |
| `User::withoutRole('writer')`, `User::withoutPermission('edit')` | ✅ `subjectsWithoutRole()`, `subjectsWithoutPermission()` |
| `role`, `permission`, `role_or_permission` middleware | ✅ Express, Fastify, Hono, Elysia, NestJS, Next.js, React Router, Nuxt, SvelteKit, Astro, TanStack Start, tRPC |
| Route-group authorization (v8.4) | ✅ router-level middleware in every integration |
| Backed enums for role and permission names (v8.0) | ✅ [typed names](https://creation.anievo.id/rbac-evolution/basic-usage/typed-names): unions or TypeScript string enums |
| `@can`, `@role` Blade directives | ✅ `<Can>`, `useCan()`, `v-can`, `v-role`, Svelte `<Can>` / `<HasRole>` |
| `canAny()` / `canAll()` route macros (v8.5) | ✅ `canAny()` / `canAll()` in Express, Fastify, Hono, Elysia, Nuxt, SvelteKit and tRPC; `@CanAny` / `@CanAll` in NestJS; `{ all: true }` rules in Next.js |
| `Role::syncModels()` (v7.4) | ✅ `rbac.role('writer').syncSubjects('user', ids)` |

## Packages

| Package | What it gives you |
| --- | --- |
| [`@anievo-id/rbac-evolution`](./packages/core) | The engine: roles, permissions, guards, teams, wildcards, cache, events, seeding |
| [`@anievo-id/rbac-evolution-prisma`](./packages/prisma) | Prisma adapter (PostgreSQL, MySQL, SQLite, SQL Server) |
| [`@anievo-id/rbac-evolution-drizzle`](./packages/drizzle) | Drizzle adapter (PostgreSQL, MySQL, SQLite) |
| [`@anievo-id/rbac-evolution-kysely`](./packages/kysely) | Kysely adapter (PostgreSQL, MySQL, SQLite, SQL Server) |
| [`@anievo-id/rbac-evolution-typeorm`](./packages/typeorm) | TypeORM adapter (PostgreSQL, MySQL, SQLite, SQL Server), TypeORM 0.3 and 1.x |
| [`@anievo-id/rbac-evolution-mongoose`](./packages/mongoose) | Mongoose adapter (MongoDB) |
| [`@anievo-id/rbac-evolution-redis`](./packages/redis) | Shared cache store for Redis and Valkey (ioredis or node-redis) |
| [`@anievo-id/rbac-evolution-express`](./packages/express) | Express middleware and route guards |
| [`@anievo-id/rbac-evolution-fastify`](./packages/fastify) | Fastify plugin and preHandler guards |
| [`@anievo-id/rbac-evolution-hono`](./packages/hono) | Hono middleware (Node.js, Bun, Workers, Edge) |
| [`@anievo-id/rbac-evolution-elysia`](./packages/elysia) | Elysia plugin and `beforeHandle` guards (Bun first) |
| [`@anievo-id/rbac-evolution-nestjs`](./packages/nestjs) | NestJS module, guard and decorators |
| [`@anievo-id/rbac-evolution-trpc`](./packages/trpc) | tRPC procedure middleware with a typed, non-null `ctx.rbac` |
| [`@anievo-id/rbac-evolution-react-router`](./packages/react-router) | React Router 7/8 and Remix: guards for loaders and actions, snapshot for `<RbacProvider>` |
| [`@anievo-id/rbac-evolution-next`](./packages/next) | Next.js middleware, server helpers, server action guards |
| [`@anievo-id/rbac-evolution-nuxt`](./packages/nuxt) | Nuxt module: SSR snapshot, page rules, Nitro helpers |
| [`@anievo-id/rbac-evolution-astro`](./packages/astro) | Astro guards for pages, endpoints and middleware, snapshot for client islands |
| [`@anievo-id/rbac-evolution-sveltekit`](./packages/sveltekit) | SvelteKit `handle` hook, guards for loads, actions and endpoints, Svelte 5 `<Can>` / `<HasRole>` |
| [`@anievo-id/rbac-evolution-tanstack-start`](./packages/tanstack-start) | TanStack Start guards for server functions, middleware and server routes, snapshot for `<RbacProvider>` |
| [`@anievo-id/rbac-evolution-react`](./packages/react) | `<Can>`, `<Cannot>`, `<HasRole>`, `useCan()` |
| [`@anievo-id/rbac-evolution-solid`](./packages/solid) | Solid 1.x and 2.x: `<Can>`, `<HasRole>`, `useCan()` accessors, SSR included |
| [`@anievo-id/rbac-evolution-vue`](./packages/vue) | `v-can`, `v-role`, `<Can>`, composables |
| [`@anievo-id/rbac-evolution-cli`](./packages/cli) | CLI like `php artisan permission:*` |

All packages share one version and run on **Node.js 20+** and **Bun**.

To see how the packages fit together, how a check is decided and which tables the adapters use, read
[How it works](https://creation.anievo.id/rbac-evolution/guide/how-it-works).

## Quality

Every push to `main` refreshes the public [Test report](https://creation.anievo.id/rbac-evolution/quality):

- **Unit and integration tests** for all 23 packages, with code coverage, including the adapter suites against real
  PostgreSQL 16, MySQL 8 and MongoDB 7 servers, and the Redis cache store against Redis 7.
- **End-to-end tests** with Playwright on the three [example apps](./examples) (Vue + Express + Drizzle,
  Next.js + Prisma, NestJS + Kysely) and the docs site: `401` for guests, `403` without access, a revoked role denied on the next
  request, and the right UI shown per role.
- **Release sync**: merging the "version packages" pull request publishes to npm with
  [provenance](https://docs.npmjs.com/generating-provenance-statements), tags the commit and creates the GitHub
  Releases. A check then confirms npm and GitHub agree for every package, after each release and every day.

## Roadmap

- [x] Core: roles, permissions, direct permissions, guards, wildcards, teams, cache, events, typed names
- [x] Adapters: memory, Prisma, Drizzle (PostgreSQL, MySQL, SQLite), Kysely, TypeORM, Mongoose
- [x] Integrations: Express, Fastify, Hono, Elysia, NestJS, Next.js, React Router, Nuxt, SvelteKit, Astro, TanStack Start, tRPC, React, Vue, Solid
- [x] CLI and declarative seeding
- [x] Documentation site, test report, E2E tests, verified releases
- [x] `canAny()` / `canAll()` guards in every integration (spatie v8.5)
- [x] `rbac.role(…).syncSubjects()` (spatie `Role::syncModels()`)
- [x] One shared guard implementation for all integrations (0.6.0)
- [x] Typed names in every guard, decorator, server helper and the CLI seed (0.8)
- [x] spatie parity: direct-permission checks, `checkPermissionTo`, `findById`, `rolesWithPermission`, guard per check and per route (`role:admin,api`), `<UnlessRole>` (0.9)
- [x] 1.0: stable API, with a [versioning promise](https://creation.anievo.id/rbac-evolution/guide/versioning)

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md) first.

## License

[MIT](./LICENSE) © AniEvo-ID
