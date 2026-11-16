-- rbac-evolution 1.2: optional expiry on role assignments and direct permissions, for PostgreSQL
-- (matches `pgRbacSchema({ expiry: true })` from @anievo-id/rbac-evolution-drizzle).
-- Run it once on a database created with `pg.sql`, then create the adapter with
-- `drizzlePgAdapter(db, pgRbacSchema({ expiry: true }), { expiry: true })`.
-- Existing rows get NULL: they stay permanent. Using a table prefix? Prefix the table names below accordingly.

ALTER TABLE "model_has_roles" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE "model_has_permissions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
