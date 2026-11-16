# 6. Community

Goal: people outside the team can ask, report and contribute without friction, and know the project is maintained.

## Already in place

- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, PR template, bug and feature issue templates
- Changesets explained in `.changeset/README.md`

## To add

- [x] **Issue forms**: convert the markdown templates in `.github/ISSUE_TEMPLATE/` to YAML issue forms with required fields (package, version, runtime, reproduction). GitHub's community profile does not count the current templates.
- [ ] **GitHub Discussions**: enable it (currently off) for questions and ideas, and point "question" issues there from `config.yml`.
- [ ] **Labels**: `package: <name>`, `type: bug|feature|docs`, `good first issue`, `help wanted`, `needs reproduction`. Seed a few `good first issue`s from [03-quality-gates.md](./03-quality-gates.md) and [05-docs.md](./05-docs.md).
- [x] **Maintainers and governance**: a short `GOVERNANCE.md`, or a section in `CONTRIBUTING.md`, covering who maintains, who can merge and release, and how decisions are made.
- [x] **Release cadence**: say how often releases happen and how long a fix takes to ship.
- [ ] **Repository metadata**: add topics (`rbac`, `authorization`, `typescript`, `nextjs`, `nestjs`, `prisma`, `spatie`, `laravel-permission`) and set the website field to the docs URL.
- [ ] **Funding** (optional): `.github/FUNDING.yml`.
- [x] **`CONTRIBUTING.md` refresh**: how to run the database suites locally (Docker commands for PostgreSQL, MySQL, MongoDB, SQL Server), how to run E2E, how changesets work.

## Done when

- [ ] Community profile on GitHub shows every item green
- [ ] Discussions enabled with a pinned "Start here" post
