# Owner actions for 1.0

Things only a repository or organization owner can do. Everything else in `planning/` is done in the repository.

## Before 1.0.0

- [ ] **Security advisory for 0.7.0.** Publish the advisory for the lookalike-subject fix (Drizzle, Kysely, Prisma
      adapters, affected `< 0.7.0`, patched `0.7.0`), so users on older versions get a Dependabot alert:
      https://github.com/AniEvo-ID/rbac-evolution/security/advisories/new
- [ ] **Enable GitHub Discussions** (Settings → General → Features), pin a "Start here" post and a
      "1.0.0 release candidate feedback" post. Then point `question` issues there in
      `.github/ISSUE_TEMPLATE/config.yml` (`contact_links`).
- [ ] **Required checks** (Settings → Branches → `main`): add `databases`, `bun`, the `peers` jobs and `CodeQL` next
      to `ci` and `e2e`. They have been green on every pull request since they were added.
- [ ] **Repository metadata** (About → ⚙): website `https://creation.anievo.id/rbac-evolution/`, topics `rbac`,
      `authorization`, `permissions`, `typescript`, `nextjs`, `nestjs`, `prisma`, `spatie`, `laravel-permission`.
- [ ] **Labels:** `package: <name>` for each package, `type: bug` / `feature` / `docs`, `good first issue`,
      `help wanted`, `needs reproduction`. The issue forms already apply `bug`, `enhancement` and `documentation`.
- [ ] **Organization security:** require 2FA, restrict who can approve the `release` environment, enable secret
      scanning and push protection (Settings → Code security).
- [ ] **OpenSSF Scorecard:** once it has run on `main`, open Security → Code scanning, filter by tool "Scorecard",
      and fix or dismiss each finding. The badge in the README shows the score.

## Optional

- [ ] `.github/FUNDING.yml` if you want a sponsor button.
- [ ] Review the targets in `SECURITY.md` (acknowledge in 3 business days, assess in 7, fix in 30). They are a
      promise by the maintainers.
