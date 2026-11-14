---
'@anievo-id/rbac-evolution-prisma': patch
'@anievo-id/rbac-evolution-mongoose': patch
---

Faster reverse lookups (`subjectsWithRole()` / `subjectsWithPermission()`) on large tables:

- Prisma: de-duplicates subject ids in the database with `groupBy` instead of loading every link row into JS. `PrismaRbacModelHasRoleDelegate` / `PrismaRbacModelHasPermissionDelegate` now include `groupBy` (every generated `PrismaClient` has it).
- Mongoose: uses an aggregation (`$group`) instead of `distinct`, whose single result document is capped at 16 MB (roughly 400k ids).
