---
'@anievo-id/rbac-evolution-drizzle': patch
'@anievo-id/rbac-evolution-kysely': patch
'@anievo-id/rbac-evolution-prisma': patch
'@anievo-id/rbac-evolution-mongoose': patch
---

Peer dependency ranges now match the versions CI tests. A new `peers` CI job installs the oldest supported version of each framework and ORM and runs that package's build, typecheck and tests. The old ranges claimed versions that don't work:

- **Drizzle:** `drizzle-orm` `>=0.36` -> `>=0.38`. On 0.36 and 0.37 the MySQL and SQLite schemas don't type-check.
- **Kysely:** `kysely` `>=0.27` -> `^0.28.0`. On 0.27, passing a `Transaction` to `kyselyAdapter()` is a type error. 0.29 moved `Migration` to `kysely/migration`, which breaks `rbacMigration()`.
- **Prisma:** `@prisma/client` `>=5` -> `^5.12.0 || ^6.0.0`. The docs already required 5.12 (`createMany` on SQLite). Prisma 7 isn't tested yet.
- **Mongoose:** `mongoose` `>=8` -> `^8.0.0`. Mongoose 9 isn't tested yet.

Nothing changes at runtime. If your package manager now warns about an unmet peer, the warning was right before: that version was never tested.
