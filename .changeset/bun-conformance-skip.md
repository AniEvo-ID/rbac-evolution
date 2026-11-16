---
'@anievo-id/rbac-evolution': patch
---

`runAdapterTests` no longer fails on Bun's test runner for adapters without the optional methods (or without expiry): the tests that don't apply end early instead of calling Vitest's `ctx.skip()`, which Bun doesn't provide.
