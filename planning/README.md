# Road to 1.0

Planning for the first stable release of RBAC Evolution. Current version: **0.6.6** (14 packages, fixed versioning).

## What "1.0" means here

1.0 is a promise, not a feature list. After 1.0:

- The public API of every package only changes in a breaking way in a new major version.
- Each supported runtime, database and framework version is tested in CI on every pull request.
- Users can upgrade within 1.x without reading the code.
- Security reports have a clear path and a supported version range.

## Plan

Work through the files in order. Each one ends with a checklist; 1.0 ships when every box is ticked.

| # | File | Goal | Size |
| --- | --- | --- | --- |
| 1 | [01-api-freeze.md](./01-api-freeze.md) | Decide what is public, rename or remove anything we don't want to support for years | L |
| 2 | [02-compatibility-and-semver.md](./02-compatibility-and-semver.md) | Write down the semver promise and the support matrix | S |
| 3 | [03-quality-gates.md](./03-quality-gates.md) | Add the checks that protect the promise (type tests, package lint, coverage floor) | M |
| 4 | [04-security.md](./04-security.md) | Harden the supply chain and write the threat model | M |
| 5 | [05-docs.md](./05-docs.md) | API reference, upgrade guide, versioned docs | M |
| 6 | [06-community.md](./06-community.md) | Make the repo easy to contribute to and easy to get help in | S |
| 7 | [07-release-1.0.md](./07-release-1.0.md) | Release candidate, feedback window, 1.0.0 | S |

Files 2, 4 and 6 do not depend on the API freeze and can run in parallel with it.

## Already in place

- MIT license, Code of Conduct, contributing guide, security policy, PR template, issue templates
- CI on Node 20 and 22, Bun, real PostgreSQL 16, MySQL 8, MongoDB 7 and SQL Server 2022, E2E with Playwright
- Changesets with fixed versioning, npm Trusted Publishing with provenance, a daily npm/GitHub sync check
- Documentation site at https://app.anievo.id/rbac-evolution/ with a public test report
- Two independent audits of the code; every finding fixed or deliberately documented

## Housekeeping found while writing this

- The README roadmap still lists "One shared guard implementation for all integrations" as open; it shipped in 0.6.0.
