# 5. Documentation

Goal: a new user succeeds without reading the source, and an existing user upgrades without surprises.

## Already in place

- Guides for every package, framework and adapter, a Laravel comparison, a CLI page, a "What's new" page
- Public test report, two example apps, mascot-guided pages

## To add

- [x] **API reference** generated from the TypeScript types (TypeDoc with the markdown plugin, or the api-extractor output from [03-quality-gates.md](./03-quality-gates.md)), one page per package, linked from each guide. Done: `docs/scripts/api.mjs` (TypeDoc + typedoc-plugin-markdown) writes `docs/api/<package>/` for every `exports` entry of all 14 packages; `pnpm docs:api`, run by the docs build, output gitignored.
- [x] **Upgrade guide 0.x → 1.0**: every rename and removal from [01-api-freeze.md](./01-api-freeze.md), with before/after code. Include the 0.6.0 blank-guard change and the SQL Server collation note.
- [x] **Versioning page** from [02-compatibility-and-semver.md](./02-compatibility-and-semver.md).
- [ ] **Versioned docs**: keep a frozen copy of the 0.x docs (for example under `/rbac-evolution/0.x/`) once 1.0 ships, and a version switcher in the nav.
- [x] **Production checklist page**: shared cache store for several processes, server-side enforcement, teams, migrations, monitoring through events.
- [x] **Recipes**: Auth.js / Lucia / Clerk session to subject, multi-tenant SaaS with teams, admin UI for roles, audit log from events. Auth.js, multi-tenant, admin UI and audit log are written; Lucia and Clerk recipes are left for later (post-1.0).
- [x] **Doc tests**: run the code blocks of the guides (or the main ones) in CI so examples can't rot. `pnpm doc:test` (`scripts/doc-tests.mjs`, CI on Node 22) type-checks the TypeScript blocks of quick start, basic usage, advanced, frameworks, adapters, best practices and recipes against the built packages: 280 blocks checked, 20 skipped (`<!-- doc-test: skip -->`: signatures, partial objects, multi-file blocks).
- [x] **README per package**: same short structure (install, 10-line example, link to docs) for all 14.
- [x] **Housekeeping**: tick "One shared guard implementation" in the README roadmap (shipped in 0.6.0).

## Done when

- [ ] API reference and upgrade guide published
- [ ] Versioned docs ready to switch on at the 1.0 release
