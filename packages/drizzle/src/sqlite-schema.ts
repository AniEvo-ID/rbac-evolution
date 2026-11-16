import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { type RbacSchemaOptions, tableNames } from './names'

/**
 * spatie-style `created_at` / `updated_at` (only on `permissions` and `roles`), stored as unix seconds
 * and exposed as `Date` by Drizzle. `strftime('%s','now')` works on every SQLite version (unlike `unixepoch()`).
 */
const timestamps = () => ({
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(cast(strftime('%s', 'now') as integer))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(cast(strftime('%s', 'now') as integer))`),
})

/**
 * Builds the rbac-evolution tables for SQLite — libsql / Turso, better-sqlite3, D1, bun:sqlite... (mirrors spatie/laravel-permission).
 *
 * ```ts
 * // schema.ts — export each table so drizzle-kit picks them up
 * export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = sqliteRbacSchema()
 * ```
 */
export function sqliteRbacSchema(options: RbacSchemaOptions & { expiry: true }): SqliteRbacExpirySchema
export function sqliteRbacSchema(options?: RbacSchemaOptions): SqliteRbacSchema
export function sqliteRbacSchema(options: RbacSchemaOptions = {}): SqliteRbacSchema | SqliteRbacExpirySchema {
  return options.expiry === true ? buildSqliteExpiry(options) : buildSqlite(options)
}

/** The five tables, as in 1.1. */
function buildSqlite(options: RbacSchemaOptions) {
  const n = tableNames(options)

  const permissions = sqliteTable(
    n.permissions,
    {
      id: integer('id').primaryKey({ autoIncrement: true }),
      name: text('name').notNull(),
      guardName: text('guard_name').notNull(),
      ...timestamps(),
    },
    (t) => [uniqueIndex(`${n.permissions}_name_guard_name_unique`).on(t.name, t.guardName)],
  )

  const roles = sqliteTable(
    n.roles,
    {
      id: integer('id').primaryKey({ autoIncrement: true }),
      name: text('name').notNull(),
      guardName: text('guard_name').notNull(),
      /** `''` = global role (no team). */
      teamId: text('team_id').notNull().default(''),
      ...timestamps(),
    },
    (t) => [uniqueIndex(`${n.roles}_name_guard_name_team_id_unique`).on(t.name, t.guardName, t.teamId)],
  )

  const roleHasPermissions = sqliteTable(
    n.roleHasPermissions,
    {
      roleId: integer('role_id')
        .notNull()
        .references(() => roles.id, { onDelete: 'cascade' }),
      permissionId: integer('permission_id')
        .notNull()
        .references(() => permissions.id, { onDelete: 'cascade' }),
    },
    (t) => [
      primaryKey({ name: `${n.roleHasPermissions}_pkey`, columns: [t.roleId, t.permissionId] }),
      index(`${n.roleHasPermissions}_permission_id_index`).on(t.permissionId),
    ],
  )

  const modelHasRoles = sqliteTable(
    n.modelHasRoles,
    {
      roleId: integer('role_id')
        .notNull()
        .references(() => roles.id, { onDelete: 'cascade' }),
      subjectType: text('subject_type').notNull(),
      subjectId: text('subject_id').notNull(),
      /** `''` = global (no team). */
      teamId: text('team_id').notNull().default(''),
    },
    (t) => [
      primaryKey({ name: `${n.modelHasRoles}_pkey`, columns: [t.subjectType, t.subjectId, t.teamId, t.roleId] }),
      index(`${n.modelHasRoles}_role_id_index`).on(t.roleId),
    ],
  )

  const modelHasPermissions = sqliteTable(
    n.modelHasPermissions,
    {
      permissionId: integer('permission_id')
        .notNull()
        .references(() => permissions.id, { onDelete: 'cascade' }),
      subjectType: text('subject_type').notNull(),
      subjectId: text('subject_id').notNull(),
      /** `''` = global (no team). */
      teamId: text('team_id').notNull().default(''),
    },
    (t) => [
      primaryKey({
        name: `${n.modelHasPermissions}_pkey`,
        columns: [t.subjectType, t.subjectId, t.teamId, t.permissionId],
      }),
      index(`${n.modelHasPermissions}_permission_id_index`).on(t.permissionId),
    ],
  )

  return { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions }
}

/**
 * The tables of `sqliteRbacSchema({ expiry: true })`: the 1.1 tables, with a nullable `expires_at` column on
 * `model_has_roles` and `model_has_permissions` (1.2).
 */
function buildSqliteExpiry(options: RbacSchemaOptions) {
  const n = tableNames(options)
  const { permissions, roles, roleHasPermissions } = buildSqlite(options)

  const modelHasRoles = sqliteTable(
    n.modelHasRoles,
    {
      roleId: integer('role_id')
        .notNull()
        .references(() => roles.id, { onDelete: 'cascade' }),
      subjectType: text('subject_type').notNull(),
      subjectId: text('subject_id').notNull(),
      /** `''` = global (no team). */
      teamId: text('team_id').notNull().default(''),
      /** When the link ends (`NULL` = never). Only used by an adapter created with `{ expiry: true }`. */
      expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    },
    (t) => [
      primaryKey({ name: `${n.modelHasRoles}_pkey`, columns: [t.subjectType, t.subjectId, t.teamId, t.roleId] }),
      index(`${n.modelHasRoles}_role_id_index`).on(t.roleId),
    ],
  )

  const modelHasPermissions = sqliteTable(
    n.modelHasPermissions,
    {
      permissionId: integer('permission_id')
        .notNull()
        .references(() => permissions.id, { onDelete: 'cascade' }),
      subjectType: text('subject_type').notNull(),
      subjectId: text('subject_id').notNull(),
      /** `''` = global (no team). */
      teamId: text('team_id').notNull().default(''),
      /** When the link ends (`NULL` = never). Only used by an adapter created with `{ expiry: true }`. */
      expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    },
    (t) => [
      primaryKey({
        name: `${n.modelHasPermissions}_pkey`,
        columns: [t.subjectType, t.subjectId, t.teamId, t.permissionId],
      }),
      index(`${n.modelHasPermissions}_permission_id_index`).on(t.permissionId),
    ],
  )

  return { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions }
}

/** The tables of `sqliteRbacSchema()`. */
export type SqliteRbacSchema = ReturnType<typeof buildSqlite>
/** The tables of `sqliteRbacSchema({ expiry: true })`: the subject-link tables have an `expiresAt` column. */
export type SqliteRbacExpirySchema = ReturnType<typeof buildSqliteExpiry>
