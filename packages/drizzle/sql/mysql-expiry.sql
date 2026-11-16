-- rbac-evolution 1.2: optional expiry on role assignments and direct permissions, for MySQL 8 / MariaDB
-- (matches `mysqlRbacSchema({ expiry: true })` from @anievo-id/rbac-evolution-drizzle).
-- Run it once on a database created with `mysql.sql` (MySQL has no ADD COLUMN IF NOT EXISTS: a second run
-- fails with "Duplicate column name", which is harmless), then create the adapter with
-- `drizzleMysqlAdapter(db, mysqlRbacSchema({ expiry: true }), { expiry: true })`.
-- Existing rows get NULL: they stay permanent. Using a table prefix? Prefix the table names below accordingly.

ALTER TABLE `model_has_roles` ADD COLUMN `expires_at` datetime(3) NULL;
ALTER TABLE `model_has_permissions` ADD COLUMN `expires_at` datetime(3) NULL;
