---
'@anievo-id/rbac-evolution-kysely': patch
---

SQL Server: `createRbacTables` now creates the string columns with the binary collation `Latin1_General_100_BIN2`, like `utf8mb4_bin` on MySQL. With the server's default (usually case-insensitive) collation, `'Edit'` and `'edit'` were the same name, so roles or permissions differing only in case collided and lookups could match the wrong one. Found by running the adapter's conformance suite against a real SQL Server, now part of CI.

Existing SQL Server tables are not changed (`createRbacTables` skips tables that exist): recreate them, or change the columns' collation, to get case-sensitive names.
