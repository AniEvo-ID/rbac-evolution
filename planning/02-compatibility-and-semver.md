# 2. Compatibility and semver

Goal: users know exactly what a minor or patch upgrade can and cannot do.

## Semver promise (draft for `docs/guide/versioning.md`)

- **Major**: anything that can break a working app. Removing or renaming an export, changing a default, changing the 401/403 body, changing what a check allows or denies for the same data.
- **Minor**: new exports, new options with a default that keeps the old behaviour, new adapter methods with a fallback, support for a new runtime or framework version.
- **Patch**: bug fixes and docs. A fix that makes a check **deny** where it wrongly allowed is a patch (security); a fix that makes it **allow** where it wrongly denied is a patch too, but is called out in the changelog.
- All packages share one version number (fixed mode). `1.x` of one package works with `1.x` of every other package.
- TypeScript type changes that only affect code relying on `@internal` or unexported types are not breaking.

Decide and write down:

- [ ] Is raising the minimum Node.js version breaking? (Common answer: only in a major.)
- [ ] Is raising a peer dependency's minimum version breaking? (Common answer: only in a major, unless the old version is end-of-life.)
- [ ] Is `moduleResolution: "node10"` (TypeScript's legacy `"node"`) supported? Main entry points resolve there, subpaths (`/testing`, `/pg`, `/middleware`, nuxt `/server`) don't, because it ignores `exports`. Either add `typesVersions` or say "node16, nodenext or bundler" in the docs. `pnpm lint:packages` skips node10 until this is decided.
- [ ] Is a new required method on `RbacAdapter` breaking for custom adapters? (See [01-api-freeze.md](./01-api-freeze.md).)

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
| Express | 4, 5 | ? |
| Fastify | 4, 5 | ? |
| Next.js | 14, 15 | ? |
| Nuxt | 3, 4 | ? |
| NestJS | 10, 11 | ? |
| React | 18, 19 | ? |
| Vue | 3.4+ | ? |
| Prisma / Drizzle / Kysely / Mongoose | current major | current major |

- [ ] Fill the "?" cells from the lockfile and the peer ranges in each `package.json`
- [x] Add Node 24 to the CI matrix
- [ ] Every "Supported" cell has a matching CI job, or the cell is narrowed until it does
- [ ] Peer dependency ranges in every `package.json` match this table

## Deprecation policy

- [ ] A deprecated API keeps working for at least one minor release, logs a one-time warning in development, and is removed only in the next major
- [ ] Deprecations are listed in the changelog and in the upgrade guide

## Done when

- [ ] `docs/guide/versioning.md` published with the promise, the matrix and the deprecation policy
- [ ] `SECURITY.md` "Supported versions" updated: latest 1.x gets fixes; 0.x gets none after 1.0 (or a fixed window)
