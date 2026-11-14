---
'@anievo-id/rbac-evolution': patch
'@anievo-id/rbac-evolution-drizzle': patch
'@anievo-id/rbac-evolution-kysely': patch
'@anievo-id/rbac-evolution-mongoose': patch
---

Adapter fixes:

- **drizzle, kysely**: `deleteRole()` / `deletePermission()` run their three deletes in one transaction on
  PostgreSQL, MySQL (and SQL Server for Kysely), so a failure midway can no longer strip a permission from every role
  while the permission itself survives. SQLite keeps running them without a transaction (sync-only drivers and
  libsql `:memory:` can't share one). Passing an existing transaction to the adapter still works.
- **drizzle, kysely**: string ids must be written as integers. `'1e3'`, `'0x1A'` or `'7.0'` no longer resolve to a
  role or permission (same rule as the Prisma adapter).
- **mongoose**: a failed first index build (e.g. a transient connection error) is retried on the next call instead
  of failing every later operation until the process restarts.
- **core**: the shared adapter test suite (`runAdapterTests`) checks that ids only match when written exactly as stored.
