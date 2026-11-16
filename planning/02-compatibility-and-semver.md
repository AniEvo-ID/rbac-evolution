# 2. Compatibility and semver

Goal: users know exactly what a minor or patch upgrade can and cannot do.

## Semver promise (draft for `docs/guide/versioning.md`)

- **Major**: anything that can break a working app. Removing or renaming an export, changing a default, changing the 401/403 body, changing what a check allows or denies for the same data.
- **Minor**: new exports, new options with a default that keeps the old behaviour, new adapter methods with a fallback, support for a new runtime or framework version.
- **Patch**: bug fixes and docs. A fix that makes a check **deny** where it wrongly allowed is a patch (security); a fix that makes it **allow** where it wrongly denied is a patch too, but is called out in the changelog.
- All packages share one version number (fixed mode). `1.x` of one package works with `1.x` of every other package.
- TypeScript type changes that only affect code relying on `@internal` or unexported types are not breaking.

Decide and write down:

- [x] Is raising the minimum Node.js version breaking? (Common answer: only in a major.)
- [x] Is raising a peer dependency's minimum version breaking? (Common answer: only in a major, unless the old version is end-of-life.)
- [x] Is `moduleResolution: "node10"` (TypeScript's legacy `"node"`) supported? Main entry points resolve there, subpaths (`/testing`, `/pg`, `/middleware`, nuxt `/server`) don't, because it ignores `exports`. Either add `typesVersions` or say "node16, nodenext or bundler" in the docs. `pnpm lint:packages` skips node10 until this is decided.
- [x] Is a new required method on `RbacAdapter` breaking for custom adapters? (See [01-api-freeze.md](./01-api-freeze.md).)

## Support matrix (draft)

| Area | Supported in 1.x | Tested in CI today |
| --- | --- | --- |
| Node.js | 20, 22, 24 | 20, 22, 24 |
| Bun | latest | latest |
| Deno | not supported | — |
| PostgreSQL | 13+ | 16 |
| MySQL / MariaDB | 8 / 10.6+ | MySQL 8 |
| SQLite | 3.35+ | via libsql / bun:sqlite |
| SQL Server | 2019+ | 2022 |
| MongoDB | 6+ | 7 |
| Express | 4, 5 | 5 (`ci`), 4 (`peers`) |
| Fastify | 5 | 5 (`ci`) |
| Hono | 4 | 4 latest (`ci`), 4.0.0 (`peers`) |
| Next.js | 14, 15, 16 | 15 (`ci`), 14 with React 18 and 16 (`peers`) |
| Nuxt | 3, 4 | 4 (`ci`), 3 (`peers`) |
| NestJS | 10, 11, 12 | 12 (`ci`), 10 and 11 (`peers`) |
| React | 18, 19 | 19 (`ci`), 18 (`peers`) |
| Vue | 3.3+ | 3.5 (`ci`), 3.3 (`peers`) |
| Prisma | 5.12+, 6 | 6 (`ci`), 5.12.0 (`peers`) |
| Drizzle | 0.38+ | 0.44 (`ci`), 0.38.0 and 0.45 (`peers`) |
| Kysely | 0.28 | 0.28 latest (`ci`), 0.28.0 without typecheck (`peers`) |
| Mongoose | 8 | 8 latest (`ci`, `databases`) |

`ci` runs each package against the dev dependency in the lockfile. The `peers` job in `.github/workflows/ci.yml`
swaps one package's dev dependency for an older (or newer) peer version and runs its build, typecheck and tests.
An open range such as `>=4` means "up to the newest major listed here"; a newer major is added to this table and to
`peers` before it is claimed.

Narrowed while filling this table (tried locally with the `peers` technique):

- Fastify 4: the plugin declares `fastify: '>=5'` to `fastify-plugin`, so Fastify 4 refuses to load it. The peer
  range was already `>=5`; the table said 4, 5.
- Drizzle 0.36 and 0.37: the MySQL and SQLite schemas (`mysqlTable` / `sqliteTable` with an array-returning
  `extraConfig`) don't type-check, so the build's `.d.ts` step fails. 0.38.0 passes. Peer range `>=0.36` -> `>=0.38`.
- Kysely 0.27: a `Transaction<DB>` isn't assignable to `Kysely<any>`, so `kyselyAdapter(trx)` is a type error.
  Kysely 0.29: `Migration` moved to `kysely/migration`, `src/schema.ts` doesn't compile and the migration test fails.
  Peer range `>=0.27` -> `^0.28.0`.
- Prisma 5.0.0: the generated client isn't assignable to `PrismaRbacClient` and the tests fail; the docs already
  said "5.12 or later" (no `createMany` on SQLite before that), and 5.12.0 passes. Prisma 7: `prisma generate` rejects
  the test schema's `datasource url`, so nothing runs against it yet. Peer range `>=5` -> `^5.12.0 || ^6.0.0`.
- Mongoose 9: type-checks, but its tests couldn't run here (the MongoDB binary download was blocked), so it has no
  `peers` entry yet. Peer range `>=8` -> `^8.0.0` until it does.
- Vue 3.3 and 3.4 failed one type test (`InjectionKey` is a `Symbol` interface before 3.5). The test now compares
  against `InjectionKey<VueRbac>`, and 3.3 passes, so the table says 3.3+ to match the existing peer range.

- [x] Fill the "?" cells from the lockfile and the peer ranges in each `package.json`
- [x] Add Node 24 to the CI matrix
- [x] Every "Supported" cell has a matching CI job, or the cell is narrowed until it does
- [x] Peer dependency ranges in every `package.json` match this table

## Deprecation policy

- [x] A deprecated API keeps working for at least one minor release, logs a one-time warning in development, and is removed only in the next major
- [x] Deprecations are listed in the changelog and in the upgrade guide

## Done when

- [x] `docs/guide/versioning.md` published with the promise, the matrix and the deprecation policy
- [x] `SECURITY.md` "Supported versions" updated: latest 1.x gets fixes; 0.x gets none after 1.0 (or a fixed window)
