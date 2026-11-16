---
'@anievo-id/rbac-evolution-kysely': patch
---

On SQL Server, links are now inserted in batches (one statement per 1000 links) instead of one row at a time, so attaching many roles or permissions takes far fewer round trips. Behaviour is unchanged: attaching stays idempotent, existing links are skipped, and foreign-key and other errors are still reported.
