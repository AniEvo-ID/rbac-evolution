---
'@anievo-id/rbac-evolution-prisma': minor
---

Support Prisma 7. The `@prisma/client` peer range is now `^5.12.0 || ^6.0.0 || ^7.0.0`.

- A Prisma 7 client fits `PrismaAdapter` as it is, whether it comes from the new `prisma-client` generator
  (`import { PrismaClient } from '<output>/client'`, ESM or CommonJS) or from `prisma-client-js`, and whatever driver
  adapter it uses (`@prisma/adapter-pg`, `@prisma/adapter-mariadb`, `@prisma/adapter-better-sqlite3`, ...). Same
  models, same options, same tables: nothing to change on the rbac side.
- Interactive transactions: a Prisma 7 `tx` client has a `$transaction` method (for nested transactions), and a
  batch `tx.$transaction([...])` starts its own transaction instead of joining yours (on SQLite, it times out). The
  adapter now treats a client without `$connect` as a `tx` client, so `deleteRole()` / `deletePermission()` / team
  deletes run on `tx`, inside your transaction, as on Prisma 5 and 6.
- Docs: a "Prisma 7" section on the Prisma adapter page (generator, `prisma.config.ts`, driver adapters).
