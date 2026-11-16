-- rbac-evolution 1.2: optional expiry on role assignments and direct permissions, for SQLite
-- (matches `sqliteRbacSchema({ expiry: true })` from @anievo-id/rbac-evolution-drizzle).
-- Run it once on a database created with `sqlite.sql` (a second run fails with "duplicate column name",
-- which is harmless), then create the adapter with
-- `drizzleSqliteAdapter(db, sqliteRbacSchema({ expiry: true }), { expiry: true })`.
-- `expires_at` holds unix milliseconds. Existing rows get NULL: they stay permanent.
-- Using a table prefix? Prefix the table names below accordingly.

ALTER TABLE "model_has_roles" ADD COLUMN "expires_at" integer;
ALTER TABLE "model_has_permissions" ADD COLUMN "expires_at" integer;
