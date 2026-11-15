# 3. Quality gates

Goal: CI catches anything that would break the 1.0 promise before it is merged.

## Already enforced

- Build, typecheck and unit tests on Node 20 and 22 (required check)
- Adapter conformance suite on real PostgreSQL, MySQL, MongoDB and SQL Server
- Bun suite
- E2E with Playwright on two example apps and the docs site (required check)
- Branch protection with up-to-date branches

## To add

- [ ] **API snapshot**: `@microsoft/api-extractor` (or a small script over the `.d.ts` files) writes `etc/<package>.api.md`; CI fails when it changes without a changeset. Makes every public API change visible in review.
- [ ] **Package lint**: `publint` and `@arethetypeswrong/cli` on every package, so ESM/CJS entry points and types resolve correctly for every consumer setup.
- [ ] **Type tests**: `expectTypeOf` (vitest) for typed names, the guard argument types and `exactOptionalPropertyTypes` users. Types are part of the public API.
- [ ] **Coverage floor**: enable `vitest --coverage` (v8), publish the number on the test report page, and fail CI below the agreed floor per package (start at the current value, never lower it).
- [ ] **Peer version matrix**: CI jobs for the oldest and newest supported major of each framework peer (from [02-compatibility-and-semver.md](./02-compatibility-and-semver.md)).
- [ ] **Node 24** in the CI matrix.
- [ ] **Bundle size**: record the size of each client package (react, vue) and fail on a large jump (`size-limit`).
- [ ] **Benchmarks** (optional for 1.0): `can()` cold and cached, `syncRoles`, reverse lookups on 100k links. Run on demand, not on every PR.
- [ ] **Make `databases` and `bun` required checks** once they have been stable for a few weeks.

## Known gaps to close

- [ ] Kysely SQL Server inserts links one row at a time; now that SQL Server runs in CI, batch them and keep the duplicate-safety.
- [ ] Next.js and Nuxt are only exercised end-to-end through the Next example; add a Nuxt or NestJS example app to E2E.

## Done when

- [ ] Every item above is merged and green on `main`
- [ ] The test report page shows coverage next to the unit and E2E counts
