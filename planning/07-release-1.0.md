# 7. Release 1.0

Goal: ship 1.0.0 only after real users have tried the release candidate.

## Steps

1. [ ] Every "Done when" box in files 1 to 6 is ticked. Open before the RC: items that need a repository owner (settings, Discussions, labels, topics), the generated API reference, doc tests and versioned docs. None changes the API, so they can land during the RC.
2. [x] Enter changesets pre-release mode: `pnpm changeset pre enter rc`
3. [x] Release `1.0.0-rc.0` through the normal release PR (npm dist-tag `rc`, `latest` stays on 0.x)
4. [x] Announce the RC (feedback issue #82): GitHub Discussions, README banner, the docs site; ask for feedback with a pinned issue
5. [x] **Feedback window: 2 to 4 weeks.** Skipped at the maintainer's request: 1.0.0 shipped the same day as rc.0, with no changes from 0.9. Fix what comes in as `1.0.0-rc.N`. Only bug fixes, no new features.
6. [ ] Upgrade both example apps and at least one real project to the RC (the example apps use the workspace packages, so their E2E tests already run on the RC code)
7. [x] Exit pre-release mode: `pnpm changeset pre exit`, then release `1.0.0` (dist-tag `latest`)
8. [ ] Switch the docs to versioned mode (1.x default, 0.x archived)
9. [x] Update `SECURITY.md` supported versions and the README roadmap
10. [ ] Announce 1.0: GitHub release notes with the upgrade guide, Discussions, and the channels the team uses

## Release notes outline

- What 1.0 means (the semver promise in one paragraph)
- Highlights since 0.1
- Breaking changes since the last 0.x, with links to the upgrade guide
- Support matrix
- Thanks to contributors

## After 1.0

- [ ] Track 1.x feature requests in Discussions; plan 2.0 only when breaking changes pile up
- [ ] Keep the daily npm/GitHub sync check and the audits (one review per minor release)
