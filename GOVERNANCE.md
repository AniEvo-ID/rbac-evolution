# Governance

## Maintainers

RBAC Evolution is maintained by [AniEvo-ID](https://github.com/AniEvo-ID). Maintainers review and merge pull
requests, cut releases and decide on the roadmap.

## How changes land

- Every change goes through a pull request. It merges when CI is green (build, types, unit tests, package lint, the
  database suites, Bun, end-to-end tests, CodeQL) and a maintainer approves it.
- A change to a published package carries a [changeset](./.changeset/README.md), which becomes its changelog entry.
- Public API changes show up in `etc/*.api.md`, so they are visible in review. The rules for what a release may
  change are in [versioning](https://creation.anievo.id/rbac-evolution/guide/versioning).

## Releases

- Releases are automatic: merging the "version packages" pull request publishes every package to npm with
  provenance, tags the commit and creates the GitHub Releases.
- **Patch releases** ship when fixes land, usually within a week. Security fixes ship as soon as they are ready; see
  [SECURITY.md](./SECURITY.md).
- **Minor releases** ship when a set of features is ready, roughly monthly.
- **Major releases** are rare and planned in the open, with an upgrade guide and at least one release candidate.

## Decisions

Small decisions happen in the pull request. Larger ones (a new package, a breaking change, a change to the
versioning promise) start as an issue so others can weigh in before code is written. When there is no consensus,
the maintainers decide and write down why.
