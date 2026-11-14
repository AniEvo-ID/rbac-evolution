-- rbac-evolution tables for SQLite (matches `sqliteRbacSchema()` from @anievo-id/rbac-evolution-drizzle).
-- Using a table prefix? Prefix every table, constraint and index name below accordingly.
-- `team_id = ''` means "global" (no team).
-- Enable `PRAGMA foreign_keys = ON` per connection for the ON DELETE CASCADE clauses to apply (the adapter deletes links itself either way).

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "name" text NOT NULL,
  "guard_name" text NOT NULL,
  "created_at" integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer))
);
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_name_guard_name_unique" ON "permissions" ("name", "guard_name");

CREATE TABLE IF NOT EXISTS "roles" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "name" text NOT NULL,
  "guard_name" text NOT NULL,
  "team_id" text NOT NULL DEFAULT '',
  "created_at" integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer))
);
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_guard_name_team_id_unique" ON "roles" ("name", "guard_name", "team_id");

CREATE TABLE IF NOT EXISTS "role_has_permissions" (
  "role_id" integer NOT NULL REFERENCES "roles" ("id") ON DELETE CASCADE,
  "permission_id" integer NOT NULL REFERENCES "permissions" ("id") ON DELETE CASCADE,
  CONSTRAINT "role_has_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);
CREATE INDEX IF NOT EXISTS "role_has_permissions_permission_id_index" ON "role_has_permissions" ("permission_id");

CREATE TABLE IF NOT EXISTS "model_has_roles" (
  "role_id" integer NOT NULL REFERENCES "roles" ("id") ON DELETE CASCADE,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "team_id" text NOT NULL DEFAULT '',
  CONSTRAINT "model_has_roles_pkey" PRIMARY KEY ("subject_type", "subject_id", "team_id", "role_id")
);
CREATE INDEX IF NOT EXISTS "model_has_roles_role_id_index" ON "model_has_roles" ("role_id");

CREATE TABLE IF NOT EXISTS "model_has_permissions" (
  "permission_id" integer NOT NULL REFERENCES "permissions" ("id") ON DELETE CASCADE,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "team_id" text NOT NULL DEFAULT '',
  CONSTRAINT "model_has_permissions_pkey" PRIMARY KEY ("subject_type", "subject_id", "team_id", "permission_id")
);
CREATE INDEX IF NOT EXISTS "model_has_permissions_permission_id_index" ON "model_has_permissions" ("permission_id");
