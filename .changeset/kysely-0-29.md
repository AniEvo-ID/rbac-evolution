---
'@anievo-id/rbac-evolution-kysely': minor
---

Supports Kysely 0.29 as well as 0.28 (peer range `^0.28.0 || ^0.29.0`).

Kysely 0.29 moved `Migration` and `Migrator` to `kysely/migration`, and its `kysely` entry point now exports a type
error under those names. `rbacMigration()` and `rbacExpiryMigration()` used to return that `Migration` type, so on
0.29 they could not be passed to a `Migrator`. They now return the new exported `RbacMigration` type, which has the
same shape as Kysely's `Migration` (`up`, optional `down`) and works with the `Migrator` of either version. On 0.28
the two types are interchangeable, so existing code keeps compiling.

Kysely 0.29 itself needs Node.js 22 or later and TypeScript 5.4 or later, and ships ES modules only. Its built-in
`PGliteDialect` is detected as `postgres`.
