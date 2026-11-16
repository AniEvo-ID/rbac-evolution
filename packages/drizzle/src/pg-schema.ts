import { index, integer, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { type RbacSchemaOptions, tableNames } from './names'

/** spatie-style `created_at` / `updated_at` (only on `permissions` and `roles`). */
const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Builds the rbac-evolution tables for PostgreSQL (mirrors spatie/laravel-permission).
 *
 * ```ts
 * // schema.ts — export each table so drizzle-kit picks them up
 * export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = pgRbacSchema()
 * ```
 */
export function pgRbacSchema(options: RbacSchemaOptions & { expiry: true }): PgRbacExpirySchema
export function pgRbacSchema(options?: RbacSchemaOptions): PgRbacSchema
export function pgRbacSchema(options: RbacSchemaOptions = {}): PgRbacSchema | PgRbacExpirySchema {
  return options.expiry === true ? buildPgExpiry(options) : buildPg(options)
}

/** The five tables, as in 1.1. */
function buildPg(options: RbacSchemaOptions) {
  const n = tableNames(options)

  const permissions = pgTable(
    n.permissions,
    {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      guardName: text('guard_name').notNull(),
      ...timestamps(),
    },
    (t) => [uniqueIndex(`${n.permissions}_name_guard_name_unique`).on(t.name, t.guardName)],
  )

  const roles = pgTable(
    n.roles,
    {
      id: serial('id').primaryKey(),
      name: text('name').notNull(),
      guardName: text('guard_name').notNull(),
      /** `''` = global role (no team). */
      teamId: text('team_id').notNull().default(''),
      ...timestamps(),
    },
    (t) => [uniqueIndex(`${n.roles}_name_guard_name_team_id_unique`).on(t.name, t.guardName, t.teamId)],
  )

  const roleHasPermissions = pgTable(
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

  const modelHasRoles = pgTable(
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

  const modelHasPermissions = pgTable(
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
 * The tables of `pgRbacSchema({ expiry: true })`: the 1.1 tables, with a nullable `expires_at` column on
 * `model_has_roles` and `model_has_permissions` (1.2).
 */
function buildPgExpiry(options: RbacSchemaOptions) {
  const n = tableNames(options)
  const { permissions, roles, roleHasPermissions } = buildPg(options)

  const modelHasRoles = pgTable(
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
      expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    },
    (t) => [
      primaryKey({ name: `${n.modelHasRoles}_pkey`, columns: [t.subjectType, t.subjectId, t.teamId, t.roleId] }),
      index(`${n.modelHasRoles}_role_id_index`).on(t.roleId),
    ],
  )

  const modelHasPermissions = pgTable(
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
      expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
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

/** The tables of `pgRbacSchema()`. */
export type PgRbacSchema = ReturnType<typeof buildPg>
/** The tables of `pgRbacSchema({ expiry: true })`: the subject-link tables have an `expiresAt` column. */
export type PgRbacExpirySchema = ReturnType<typeof buildPgExpiry>
