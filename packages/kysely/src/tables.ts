import type { ColumnType, Generated } from 'kysely'

/**
 * `created_at` / `updated_at`. Filled by a column default; the adapter never reads or writes them.
 * PostgreSQL, MySQL and SQL Server drivers usually return a `Date`; SQLite stores unix seconds (`number`).
 */
export type RbacTimestamp = ColumnType<Date | number | string, Date | number | string | undefined, Date | number | string>

export interface PermissionsTable {
  id: Generated<number>
  name: string
  guard_name: string
  created_at: RbacTimestamp
  updated_at: RbacTimestamp
}

export interface RolesTable {
  id: Generated<number>
  name: string
  guard_name: string
  /** `''` = global (no team). */
  team_id: Generated<string>
  created_at: RbacTimestamp
  updated_at: RbacTimestamp
}

export interface RoleHasPermissionsTable {
  role_id: number
  permission_id: number
}

export interface ModelHasRolesTable {
  role_id: number
  subject_type: string
  subject_id: string
  /** `''` = global (no team). */
  team_id: Generated<string>
}

export interface ModelHasPermissionsTable {
  permission_id: number
  subject_type: string
  subject_id: string
  /** `''` = global (no team). */
  team_id: Generated<string>
}

interface RbacTableMap {
  permissions: PermissionsTable
  roles: RolesTable
  role_has_permissions: RoleHasPermissionsTable
  model_has_roles: ModelHasRolesTable
  model_has_permissions: ModelHasPermissionsTable
}

/**
 * The five rbac-evolution tables, keyed by table name. Merge it into your Kysely `Database` type:
 *
 * ```ts
 * interface Database extends RbacDatabase { users: UsersTable }
 * // with a prefix: interface Database extends RbacDatabase<'rbac_'> { ... }
 * ```
 */
export type RbacDatabase<Prefix extends string = ''> = {
  [K in keyof RbacTableMap as `${Prefix}${K}`]: RbacTableMap[K]
}

export interface RbacTableOptions {
  /** Prepended to every table, constraint and index name, e.g. `'rbac_'` → `rbac_permissions`. Default: `''`. */
  prefix?: string
}

export interface RbacTableNames {
  permissions: string
  roles: string
  roleHasPermissions: string
  modelHasRoles: string
  modelHasPermissions: string
}

export const tableNames = (options: RbacTableOptions = {}): RbacTableNames => {
  const prefix = options.prefix ?? ''
  return {
    permissions: `${prefix}permissions`,
    roles: `${prefix}roles`,
    roleHasPermissions: `${prefix}role_has_permissions`,
    modelHasRoles: `${prefix}model_has_roles`,
    modelHasPermissions: `${prefix}model_has_permissions`,
  }
}
