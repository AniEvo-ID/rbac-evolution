# Security Policy

`rbac-evolution` is an authorization library, so security reports are taken seriously.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, report it privately via
[GitHub Security Advisories](https://github.com/AniEvo-ID/rbac-evolution/security/advisories/new).

Please include:

- A description of the issue and its impact
- Steps to reproduce (or a proof of concept)
- Affected package(s) and version(s)

## What happens next

| Step | Target |
| --- | --- |
| We acknowledge your report | within 3 business days |
| We confirm the issue and its severity, or explain why it is not one | within 7 days |
| We ship a fix, or share a mitigation and a plan | within 30 days (sooner for critical issues) |

We keep you updated in the advisory, credit you in the release notes (unless you prefer not to be named), and
publish a GitHub Security Advisory once a fixed version is on npm.

## Supported versions

| Version | Security fixes |
| --- | --- |
| Latest 1.x minor | ✅ |
| Older 1.x minors | Upgrade to the latest 1.x minor (no breaking changes within 1.x) |
| 0.x | Critical issues only, for three months after 1.0.0 is released; then none |

All packages share one version number, so "latest 1.x" means the same version of every `@anievo-id/rbac-evolution*`
package. See [versioning](https://creation.anievo.id/rbac-evolution/guide/versioning).
