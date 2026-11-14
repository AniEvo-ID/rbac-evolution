---
'@anievo-id/rbac-evolution': patch
'@anievo-id/rbac-evolution-nestjs': patch
---

Security and consistency fixes:

- **nestjs**: `RbacGuard` no longer skips the check on repeat calls from long-lived contexts. A WebSocket client (or GraphQL context) that was denied once is now checked again on every message instead of being let through, and a role revoked during a connection takes effect on the next message. Handlers are only marked as enforced after every requirement passed, and only for HTTP requests and RPC messages.
- **core**: a role/permission lookup that was in flight while roles or permissions changed no longer writes its stale result into the cache (which could keep a revoked permission alive until the cache TTL ran out).
- **core**: `syncRoles()`, `syncPermissions()` and `rbac.role(...).syncPermissions()` now attach the new list first and then detach only what is no longer in it, so a failure midway leaves extra roles/permissions instead of none.
