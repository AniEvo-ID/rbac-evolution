# 5. Documentation

Goal: a new user succeeds without reading the source, and an existing user upgrades without surprises.

## Already in place

- Guides for every package, framework and adapter, a Laravel comparison, a CLI page, a "What's new" page
- Public test report, two example apps, mascot-guided pages

## To add

- [ ] **API reference** generated from the TypeScript types (TypeDoc with the markdown plugin, or the api-extractor output from [03-quality-gates.md](./03-quality-gates.md)), one page per package, linked from each guide.
- [ ] **Upgrade guide 0.x → 1.0**: every rename and removal from [01-api-freeze.md](./01-api-freeze.md), with before/after code. Include the 0.6.0 blank-guard change and the SQL Server collation note.
- [ ] **Versioning page** from [02-compatibility-and-semver.md](./02-compatibility-and-semver.md).
- [ ] **Versioned docs**: keep a frozen copy of the 0.x docs (for example under `/rbac-evolution/0.x/`) once 1.0 ships, and a version switcher in the nav.
- [ ] **Production checklist page**: shared cache store for several processes, server-side enforcement, teams, migrations, monitoring through events.
- [ ] **Recipes**: Auth.js / Lucia / Clerk session to subject, multi-tenant SaaS with teams, admin UI for roles, audit log from events.
- [ ] **Doc tests**: run the code blocks of the guides (or the main ones) in CI so examples can't rot.
- [ ] **README per package**: same short structure (install, 10-line example, link to docs) for all 14.
- [ ] **Housekeeping**: tick "One shared guard implementation" in the README roadmap (shipped in 0.6.0).

## Done when

- [ ] API reference and upgrade guide published
- [ ] Versioned docs ready to switch on at the 1.0 release
