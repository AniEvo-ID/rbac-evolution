# 3. Quality gates

Goal: CI catches anything that would break the 1.0 promise before it is merged.

## Already enforced

- Build, typecheck and unit tests on Node 20 and 22 (required check)
- Adapter conformance suite on real PostgreSQL, MySQL, MongoDB and SQL Server
- Bun suite
- E2E with Playwright on two example apps and the docs site (required check)
- Branch protection with up-to-date branches

## To add

- [x] **API snapshot**: `@microsoft/api-extractor` (or a small script over the `.d.ts` files) writes `etc/<package>.api.md`; CI fails when it changes without a changeset. Makes every public API change visible in review. `scripts/api-snapshot.mjs` (`pnpm api:snapshot` / `pnpm api:check`, run in the `ci` job on Node 22); `scripts/check-api-changeset.mjs` fails a pull request that changes `etc/` without adding a `.changeset/*.md`.
- [x] **Package lint**: `publint` and `@arethetypeswrong/cli` on every package, so ESM/CJS entry points and types resolve correctly for every consumer setup. `pnpm lint:packages` (`scripts/lint-packages.mjs`), run in the `ci` job on Node 22. The first run found that the nuxt types fell back to `any` under node16/nodenext; fixed.
- [x] **Type tests**: `expectTypeOf` (vitest) for typed names, the guard argument types and `exactOptionalPropertyTypes` users. Types are part of the public API. `test/types.test.ts` in all 14 packages, enforced by `pnpm typecheck`. They found that options rejected an explicit `undefined`; fixed.
- [x] **Coverage floor**: enable `vitest --coverage` (v8), publish the number on the test report page, and fail CI below the agreed floor per package (start at the current value, never lower it). Coverage is on the test report page; the `databases` job checks `coverage-floor.json`. Floors set from the first CI run (rounded down).
- [ ] **Peer version matrix**: CI jobs for the oldest and newest supported major of each framework peer (from [02-compatibility-and-semver.md](./02-compatibility-and-semver.md)).
- [x] **Node 24** in the CI matrix.
- [x] **Bundle size**: record the size of each client package (react, vue) and fail on a large jump (`size-limit`). `pnpm size` (`.size-limit.json`, preset-small-lib, brotli, core bundled, framework peers ignored) for react, vue and `next/middleware`, run in the `ci` job on Node 22; limits are the first measurement + ~10%.
- [ ] **Benchmarks** (optional for 1.0): `can()` cold and cached, `syncRoles`, reverse lookups on 100k links. Run on demand, not on every PR.
- [ ] **Make `databases` and `bun` required checks** once they have been stable for a few weeks.

## Known gaps to close

- [x] Kysely SQL Server inserts links one row at a time; now that SQL Server runs in CI, batch them and keep the duplicate-safety. One `INSERT ... SELECT ... FROM (VALUES ...) WHERE NOT EXISTS` per 1000 links (and under 2100 parameters); a duplicate-key error from a concurrent insert retries that chunk row by row. SQL pinned in `compile.test.ts`; 1200-link attach test in the shared database suite.
- [ ] Next.js and Nuxt are only exercised end-to-end through the Next example; add a Nuxt or NestJS example app to E2E.

## Done when

- [ ] Every item above is merged and green on `main`
- [ ] The test report page shows coverage next to the unit and E2E counts
