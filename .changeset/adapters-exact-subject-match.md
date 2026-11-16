---
'@anievo-id/rbac-evolution-drizzle': patch
'@anievo-id/rbac-evolution-kysely': patch
'@anievo-id/rbac-evolution-prisma': patch
---

**Security:** a subject id, subject type or team id that differs from another one only by trailing spaces (and, with Prisma on MySQL's default collation, by case or accents) no longer gets that subject's roles and permissions.

SQL compares text with the column's collation. MySQL's `utf8mb4_bin` (used by the Drizzle and Kysely schemas) is PAD SPACE, SQL Server always ignores trailing spaces, and Prisma can't set a collation, so MySQL's case- and accent-insensitive default applies. A user with the id `'admin '` was therefore given the roles of `'admin'`, and with Prisma on MySQL so was `'ADMIN'`. This matters when subject ids are strings that users can influence, such as usernames.

The adapters now re-check every row they read with exact string equality: role and permission lookups, a subject's links and the reverse lookups. Detaching a lookalike's links no longer removes the real subject's. No schema change or migration is needed. PostgreSQL, SQLite and MongoDB were not affected.

Found by the new exact-matching tests of the adapter conformance suite, run against real MySQL and SQL Server servers in CI.
