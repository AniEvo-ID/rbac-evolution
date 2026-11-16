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
