import { sqliteRbacSchema } from '@anievo-id/rbac-evolution-drizzle/sqlite'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Demo app tables
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
})

export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export type User = typeof users.$inferSelect

// The five rbac-evolution tables (permissions, roles, role_has_permissions, model_has_roles, model_has_permissions)
export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = sqliteRbacSchema()

// Same tables as plain SQL, used by `pnpm db:setup` instead of drizzle-kit.
export const APP_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS "articles" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "published" integer NOT NULL DEFAULT 0,
  "author_id" integer NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
`
