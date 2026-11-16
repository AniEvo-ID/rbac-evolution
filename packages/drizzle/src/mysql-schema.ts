import {
  customType,
  datetime,
  index,
  int,
  mysqlTable,
  primaryKey,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/mysql-core'
import { type RbacSchemaOptions, tableNames } from './names'

/**
 * Column lengths. MySQL cannot fully index `TEXT`, and InnoDB caps an index key at 3072 bytes
 * (768 `utf8mb4` characters), so every indexed string column is a bounded `varchar`:
 * - `roles` unique key: name (255) + guard_name (255) + team_id (191) = 701 chars
 * - `model_has_*` primary key: subject_type (191) + subject_id (191) + team_id (191) + int = 573 chars + 4 bytes
 */
const MYSQL_LENGTHS = {
  name: 255,
  guardName: 255,
  teamId: 191,
  subjectType: 191,
  subjectId: 191,
} as const

/**
 * `varchar(n)` with a binary collation, so names, subject ids and team ids compare exactly
 * (case- and accent-sensitive) like on PostgreSQL / SQLite, whatever the table's default collation is.
 * Without it, MySQL's default `utf8mb4_0900_ai_ci` would make `'abc'` and `'ABC'` the same subject id.
 */
const exactVarchar = customType<{ data: string; driverData: string; config: { length: number }; configRequired: true }>({
  dataType: (config) => `varchar(${config.length}) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`,
})

/** spatie-style `created_at` / `updated_at` (only on `permissions` and `roles`). */
const timestamps = () => ({
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
})

/**
 * Builds the rbac-evolution tables for MySQL 8 / MariaDB (mirrors spatie/laravel-permission).
 *
 * ```ts
 * // schema.ts — export each table so drizzle-kit picks them up
 * export const { permissions, roles, roleHasPermissions, modelHasRoles, modelHasPermissions } = mysqlRbacSchema()
 * ```
 */
export function mysqlRbacSchema(options: RbacSchemaOptions & { expiry: true }): MysqlRbacExpirySchema
export function mysqlRbacSchema(options?: RbacSchemaOptions): MysqlRbacSchema
export function mysqlRbacSchema(options: RbacSchemaOptions = {}): MysqlRbacSchema | MysqlRbacExpirySchema {
  return options.expiry === true ? buildMysqlExpiry(options) : buildMysql(options)
}

/** The five tables, as in 1.1. */
function buildMysql(options: RbacSchemaOptions) {
  const n = tableNames(options)

  const permissions = mysqlTable(
    n.permissions,
    {
      id: int('id').autoincrement().primaryKey(),
      name: exactVarchar('name', { length: MYSQL_LENGTHS.name }).notNull(),
      guardName: exactVarchar('guard_name', { length: MYSQL_LENGTHS.guardName }).notNull(),
      ...timestamps(),
    },
    (t) => [uniqueIndex(`${n.permissions}_name_guard_name_unique`).on(t.name, t.guardName)],
  )

  const roles = mysqlTable(
    n.roles,
    {
      id: int('id').autoincrement().primaryKey(),
      name: exactVarchar('name', { length: MYSQL_LENGTHS.name }).notNull(),
      guardName: exactVarchar('guard_name', { length: MYSQL_LENGTHS.guardName }).notNull(),
      /** `''` = global role (no team). */
      teamId: exactVarchar('team_id', { length: MYSQL_LENGTHS.teamId }).notNull().default(''),
      ...timestamps(),
    },
    (t) => [uniqueIndex(`${n.roles}_name_guard_name_team_id_unique`).on(t.name, t.guardName, t.teamId)],
  )

  const roleHasPermissions = mysqlTable(
    n.roleHasPermissions,
    {
      roleId: int('role_id')
        .notNull()
        .references(() => roles.id, { onDelete: 'cascade' }),
      permissionId: int('permission_id')
        .notNull()
        .references(() => permissions.id, { onDelete: 'cascade' }),
    },
    (t) => [
      primaryKey({ name: `${n.roleHasPermissions}_pkey`, columns: [t.roleId, t.permissionId] }),
      index(`${n.roleHasPermissions}_permission_id_index`).on(t.permissionId),
    ],
  )

  const modelHasRoles = mysqlTable(
    n.modelHasRoles,
    {
      roleId: int('role_id')
        .notNull()
        .references(() => roles.id, { onDelete: 'cascade' }),
      subjectType: exactVarchar('subject_type', { length: MYSQL_LENGTHS.subjectType }).notNull(),
      subjectId: exactVarchar('subject_id', { length: MYSQL_LENGTHS.subjectId }).notNull(),
      /** `''` = global (no team). */
      teamId: exactVarchar('team_id', { length: MYSQL_LENGTHS.teamId }).notNull().default(''),
    },
    (t) => [
      primaryKey({ name: `${n.modelHasRoles}_pkey`, columns: [t.subjectType, t.subjectId, t.teamId, t.roleId] }),
      index(`${n.modelHasRoles}_role_id_index`).on(t.roleId),
    ],
  )

  const modelHasPermissions = mysqlTable(
    n.modelHasPermissions,
    {
      permissionId: int('permission_id')
        .notNull()
        .references(() => permissions.id, { onDelete: 'cascade' }),
      subjectType: exactVarchar('subject_type', { length: MYSQL_LENGTHS.subjectType }).notNull(),
      subjectId: exactVarchar('subject_id', { length: MYSQL_LENGTHS.subjectId }).notNull(),
      /** `''` = global (no team). */
      teamId: exactVarchar('team_id', { length: MYSQL_LENGTHS.teamId }).notNull().default(''),
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
 * The tables of `mysqlRbacSchema({ expiry: true })`: the 1.1 tables, with a nullable `expires_at` column on
 * `model_has_roles` and `model_has_permissions` (1.2).
 */
function buildMysqlExpiry(options: RbacSchemaOptions) {
  const n = tableNames(options)
  const { permissions, roles, roleHasPermissions } = buildMysql(options)

  const modelHasRoles = mysqlTable(
    n.modelHasRoles,
    {
      roleId: int('role_id')
        .notNull()
        .references(() => roles.id, { onDelete: 'cascade' }),
      subjectType: exactVarchar('subject_type', { length: MYSQL_LENGTHS.subjectType }).notNull(),
      subjectId: exactVarchar('subject_id', { length: MYSQL_LENGTHS.subjectId }).notNull(),
      /** `''` = global (no team). */
      teamId: exactVarchar('team_id', { length: MYSQL_LENGTHS.teamId }).notNull().default(''),
      /** When the link ends (`NULL` = never). Only used by an adapter created with `{ expiry: true }`. */
      expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }),
    },
    (t) => [
      primaryKey({ name: `${n.modelHasRoles}_pkey`, columns: [t.subjectType, t.subjectId, t.teamId, t.roleId] }),
      index(`${n.modelHasRoles}_role_id_index`).on(t.roleId),
    ],
  )

  const modelHasPermissions = mysqlTable(
    n.modelHasPermissions,
    {
      permissionId: int('permission_id')
        .notNull()
        .references(() => permissions.id, { onDelete: 'cascade' }),
      subjectType: exactVarchar('subject_type', { length: MYSQL_LENGTHS.subjectType }).notNull(),
      subjectId: exactVarchar('subject_id', { length: MYSQL_LENGTHS.subjectId }).notNull(),
      /** `''` = global (no team). */
      teamId: exactVarchar('team_id', { length: MYSQL_LENGTHS.teamId }).notNull().default(''),
      /** When the link ends (`NULL` = never). Only used by an adapter created with `{ expiry: true }`. */
      expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }),
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

/** The tables of `mysqlRbacSchema()`. */
export type MysqlRbacSchema = ReturnType<typeof buildMysql>
/** The tables of `mysqlRbacSchema({ expiry: true })`: the subject-link tables have an `expiresAt` column. */
export type MysqlRbacExpirySchema = ReturnType<typeof buildMysqlExpiry>
