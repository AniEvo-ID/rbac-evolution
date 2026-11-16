---
'@anievo-id/rbac-evolution': minor
---

The adapter conformance suite (`runAdapterTests` from `@anievo-id/rbac-evolution/testing`) now checks exact matching: role and permission names, guards, subject types, subject ids and team ids that differ only by case, accents or a trailing space must stay apart. A database collation that ignores case (MySQL's default, SQL Server's usual one) must not let a user `ADMIN` get the roles of `admin`. If you maintain a custom adapter, run the suite: these tests may fail where your columns use such a collation.
