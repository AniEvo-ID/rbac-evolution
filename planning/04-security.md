# 4. Security

Goal: an authorization library people can trust in production, with the evidence to back it.

## Already in place

- Private reporting via GitHub Security Advisories (`SECURITY.md`)
- npm Trusted Publishing with provenance; the publish job pins its npm version
- Fail-closed guards: blank or missing requirements deny or throw, never allow
- Two code audits, findings fixed with regression tests

## To add

- [x] **Threat model** (`docs/best-practices/threat-model.md`): what the library protects against and what it does not. For example: client-side checks are UI only, the snapshot can be stale, cache invalidation across processes needs a shared store, teams isolation depends on the app passing the right team.
- [x] **Dependency updates**: Dependabot or Renovate for npm and GitHub Actions, grouped weekly, with CI as the gate. Dependabot, with a 7-day cooldown.
- [x] **Pin GitHub Actions by commit SHA** in `release.yml` (the job that can publish). Done in every workflow; Dependabot keeps the SHAs current.
- [x] **CodeQL** (or another SAST) on pull requests. `javascript-typescript` and `actions`, `security-extended` queries.
- [ ] **OpenSSF Scorecard** workflow and badge; fix the high-impact findings. Workflow and badge added; the first score appears after the first run on `main`.
- [x] **Fuzz the name parsers** (pipes, blanks, wildcards, unicode) with property-based tests (`fast-check`): no input may turn a deny into an allow. `packages/core/test/fuzz.test.ts`; checked by injecting four bugs, all caught. Plus "exact matching" tests in the adapter conformance suite (lookalike names, subject ids, subject types and team ids).
- [x] **Multi-process cache test**: two `Rbac` instances sharing a Redis-like store; a revoke in one is seen by the other on the next check. `packages/core/test/shared-cache.test.ts`.
- [ ] **Repository settings** (needs an owner): require 2FA for the org, restrict who can approve the release environment, enable secret scanning and push protection.
- [x] **Response time target** in `SECURITY.md` (for example: acknowledge within 3 days, fix or mitigation plan within 30).

## Done when

- [x] Threat model published and linked from the security page
- [ ] Scorecard score recorded, high-impact findings resolved
- [x] `SECURITY.md` has supported versions and response times for 1.x
