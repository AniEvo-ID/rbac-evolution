# Threat model

What RBAC Evolution protects against, what it assumes about your app, and what it leaves to you. Use it to decide
where the library's job ends and yours begins. For day-to-day practices, see [Security](/best-practices/security).

## What the library is

A server-side decision function: given a **subject**, a **guard**, an optional **team** and a role or permission
name, it answers *allowed* or *not allowed* from the data in your database. The framework integrations turn that
answer into a 401, a 403, a redirect or a `notFound()`.

It does not authenticate anyone, store sessions, or decide who belongs to which team.

## What it guarantees

Each guarantee has tests that would fail if it broke.

| Guarantee | How it is tested |
| --- | --- |
| **No odd name turns a deny into an allow.** Blank names, pipes, dots, commas, `*`, other letter case, Unicode lookalikes (Cyrillic `а`, combining accents) and invisible characters match only the exact name they spell, after trimming surrounding whitespace. | Property-based tests over thousands of generated names (`packages/core/test/fuzz.test.ts`) |
| **Wildcards cover only what the rules say.** `articles` and `articles.*` cover `articles.edit`; `articles.edit` covers neither `articles.*` nor `articles`. A grant never widens when it gets more specific. | The same property tests, checked against an independent spec, plus the wildcard unit tests |
| **Malformed input fails closed.** An unknown permission or an invalid wildcard makes `can()` return `false` instead of throwing; a guard defined without any name throws when it is defined; a missing subject gets a 401. | Unit and property tests in core and in every integration |
| **Guards are separate.** A role or permission of the `api` guard never grants anything in the `web` guard. | Core and adapter conformance tests |
| **Changes take effect at once in the process that made them**, and in every process that shares the cache store. | `packages/core/test/shared-cache.test.ts` (two engines, one database, one async JSON store) |
| **Every adapter matches exactly.** Role and permission names, guards, subject types, subject ids and team ids that differ only by case, accents or a trailing space are kept apart, so a user `ADMIN` or `admin ` never gets the roles of `admin`, whatever the database's collation (the SQL adapters re-check every row in JavaScript, because MySQL's `utf8mb4_bin` and SQL Server ignore trailing spaces). | The "exact matching" tests of the shared adapter conformance suite, run against real PostgreSQL, MySQL, SQL Server and MongoDB servers in CI |

## What it assumes

If one of these is false, the answers above are correct for the wrong question.

- **The subject is authenticated.** `getSubject` (or your own code) returns the user that actually sent the request.
  The library trusts whatever subject it is given.
- **The team is checked.** With `teams: true`, the team you pass is used as is. If it comes from the request, verify
  membership first. See [Teams](/best-practices/security#teams).
- **Role and permission names come from your code**, not from users. The parsers are safe with any input, but a
  name chosen by a user can still be one that exists.
- **The database is trusted.** Anyone who can write to the RBAC tables can grant anything.
- **The cache store is dedicated to RBAC Evolution** (or namespaced), and only your app can write to it. A value
  written into it is trusted like a database row.
- **Changes go through the engine**, or you call `rbac.forgetCachedPermissions()` after changing the tables any other
  way (SQL, a seed script, another tool).

## What it does not protect against

| Risk | Why | What to do |
| --- | --- | --- |
| Client-side checks being bypassed | `<Can>`, `useCan()`, `v-can` and router guards run in the browser | Enforce every rule on the server. See [Enforce on the server](/best-practices/security#enforce-on-the-server-decorate-on-the-client) |
| Stale snapshots | A snapshot (also one stored in a token) is a copy taken at one moment | Refresh it when roles change, keep token lifetimes short. See [Snapshots](/best-practices/security#snapshots) |
| Stale answers in other processes | With the default in-memory cache, each process only clears its own cache | Use a shared store, a short `cacheTtl` or `cache: false`. See [Caching across processes](/best-practices/security#caching-across-processes) |
| A lookup racing a change, with a shared store | A check that started reading before a change in another process can write its older result back to the shared store after that process cleared it. That result is served until it expires | Keep `cacheTtl` short where revocations must apply within seconds |
| Partial `sync()` | Adapters have no transactions, so a failure halfway leaves the earlier changes | Rerun `sync()`: it is idempotent |
| Over-broad grants | `*`, `superAdminRoles` and a `before` hook that returns `true` are allowed by design | Keep them rare and audit them with [events](/advanced/events). See [Super-admins](/best-practices/security#super-admins) |
| Leaking the access model | Snapshots show the user their own role and permission names; engine errors contain names | Don't put secrets in names; don't send engine errors to clients. See [Error responses](/best-practices/security#error-responses) |
| Denial of service | Checks cost database reads, and a subject with very many roles or permissions costs more | Rate-limit as for any endpoint, keep the cache on |

## Supply chain

- Packages are published from GitHub Actions with npm Trusted Publishing (no long-lived token) and provenance. Check
  them with `npm audit signatures`. See [Verifying the packages](/best-practices/security#verifying-the-packages).
- Every GitHub Action is pinned to a commit SHA. Dependabot proposes updates to actions and npm packages weekly, a
  week after their release, and CI gates each one.
- CodeQL scans the code and the workflows on every pull request. OpenSSF Scorecard rates the repository's practices
  every week.

## Reporting a vulnerability

Report it privately through
[GitHub Security Advisories](https://github.com/AniEvo-ID/rbac-evolution/security/advisories/new). See the
[security policy](https://github.com/AniEvo-ID/rbac-evolution/blob/main/SECURITY.md).
