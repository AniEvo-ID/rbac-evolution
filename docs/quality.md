---
title: Test report
outline: false
aside: false
---

# Test report

The results of the latest run on `main`. CI regenerates this page on every push to `main`, so the numbers always
match the published docs.

## Unit & integration tests

Every package's test suite, including the adapter suites against real PostgreSQL, MySQL and MongoDB servers, with
code coverage.

<QualityReport />

## End-to-end tests

[Playwright](https://playwright.dev) runs the two [example apps](/guide/examples) and this site in a real browser:
guests get `401`, users without access get `403`, a revoked role is denied on the next request, and `<Can>` /
`v-can` show or hide the right parts of the UI.

<E2eReport />

## Releases: GitHub ↔ npm

Releases are automatic: merging the "version packages" pull request publishes every package to npm with
[provenance](https://docs.npmjs.com/generating-provenance-statements), tags the commit and creates the GitHub
Releases. This check confirms the result for every package: the version on npm, its provenance, npm's `latest`
tag, the git tag and the GitHub Release. It runs after each release and every day.

<ReleaseSync />
