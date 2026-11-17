# Contributing to rbac-evolution

Thanks for your interest in contributing! 🎉

## Getting started

Requirements: Node.js >= 20 and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/AniEvo-ID/rbac-evolution.git
cd rbac-evolution
pnpm install
pnpm build
pnpm test
```

## Repository structure

```
packages/
  core/        @anievo-id/rbac-evolution — framework-agnostic engine
  ...          adapters & framework integrations
examples/      example apps (Next.js, Vue, ...)
```

## Workflow

1. Fork the repo and create a branch from `main` (e.g. `feat/wildcard-permissions`, `fix/cache-invalidation`).
2. Make your changes, with tests where it makes sense.
3. Run `pnpm build && pnpm typecheck && pnpm test` and make sure everything passes.
   If you changed a `package.json`, the build config or the exports, also run `pnpm lint:packages`
   (publint and arethetypeswrong: every entry point and its types resolve for consumers).
4. If your change affects a published package, add a changeset:
   ```bash
   pnpm changeset
   ```
5. Open a pull request and fill in the PR template.

## Running the database suites

The adapter suites against real servers run when their URL is set, and are skipped otherwise. CI runs all of them.
Locally, start the servers with Docker:

```bash
docker run -d --name rbac-pg -e POSTGRES_USER=rbac -e POSTGRES_PASSWORD=rbac -e POSTGRES_DB=rbac -p 5432:5432 postgres:16
docker run -d --name rbac-mysql -e MYSQL_ROOT_PASSWORD=rbac -e MYSQL_DATABASE=rbac -p 3306:3306 mysql:8
docker run -d --name rbac-mongo -p 27017:27017 mongo:7
docker run -d --name rbac-mssql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=Rbac_Test_2026 -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
```

Then run the tests with the URLs (the same ones CI uses):

```bash
PG_URL=postgresql://rbac:rbac@localhost:5432/rbac \
MYSQL_URL=mysql://root:rbac@127.0.0.1:3306/rbac \
MONGO_URL=mongodb://localhost:27017/rbac \
MSSQL_URL=mssql://sa:Rbac_Test_2026@localhost:1433/master \
pnpm test
```

To see coverage against the floors in `coverage-floor.json`, run
`node scripts/test-report.mjs --out=coverage-report.json --floor=coverage-floor.json` with the same variables.

## Running the end-to-end tests

Playwright runs the three example apps and the docs site:

```bash
pnpm turbo run build --filter=./packages/*
pnpm --filter rbac-evolution-e2e exec playwright install chromium
pnpm --filter rbac-evolution-e2e prepare:apps
pnpm --filter rbac-evolution-e2e test:e2e
```

## Running the benchmarks

On demand only, not on every pull request: `can()` cold and cached, `syncRoles()` and reverse lookups on 100k role
links, on the memory adapter and on SQLite (`tests/bench`). About two minutes; `BENCH_SUBJECTS=10000` for a quick run.

```bash
pnpm turbo run build --filter=./packages/*
pnpm --filter rbac-evolution-bench bench
```

The **Benchmarks** workflow (Actions → Benchmarks → Run workflow) runs the same on a CI runner and puts a table in the
job summary. Compare a change against `main` on the same machine: absolute numbers vary between runners.

## Changesets

Every change to a published package needs a changeset: run `pnpm changeset`, pick the packages and the bump
(`patch` for fixes, `minor` for new features), and describe the change for users in one or two sentences. All
packages share one version number. See [.changeset/README.md](./.changeset/README.md) and
[versioning](https://creation.anievo.id/rbac-evolution/guide/versioning) for what each bump may contain.

### Adding a new package

Releases publish with npm Trusted Publishing, which npm only offers for a package that already exists. So the first
version of a new package can't come from CI, and the release check (`scripts/check-npm-names.mjs`, run by
`pnpm release`) stops the whole release, before anything is published, while a package is missing on npm. Before
merging the release PR that first includes a new package, an owner of the `@anievo-id` npm scope:

1. publishes a placeholder of it by hand (version `0.0.0`, only a `package.json`), and
2. adds a trusted publisher in the package settings on npmjs.com: GitHub Actions, `AniEvo-ID/rbac-evolution`,
   workflow `release.yml`. npm expects the first publish through it within two days.

## Governance

Who maintains the project, how changes are merged and released, and how decisions are made: see
[GOVERNANCE.md](./GOVERNANCE.md).

## Commit messages

We recommend [Conventional Commits](https://www.conventionalcommits.org/), e.g.:

- `feat(core): add wildcard permission matching`
- `fix(prisma): handle missing role gracefully`
- `docs: improve README examples`

## Reporting bugs & requesting features

Please use the [issue templates](https://github.com/AniEvo-ID/rbac-evolution/issues/new/choose).
For security issues, **do not** open a public issue — see [SECURITY.md](./SECURITY.md).

## Code of Conduct

By participating in this project you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).
