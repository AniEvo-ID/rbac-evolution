export interface RbacSchemaOptions {
  /** Prepended to every table name, e.g. `'rbac_'` → `rbac_permissions`. Default: `''`. */
  prefix?: string | undefined
  /**
   * Add the nullable `expires_at` column to `model_has_roles` and `model_has_permissions` (1.2), for an adapter
   * created with `{ expiry: true }`. Default: `false` (the 1.1 tables).
   */
  expiry?: boolean | undefined
}

export interface RbacTableNames {
  permissions: string
  roles: string
  roleHasPermissions: string
  modelHasRoles: string
  modelHasPermissions: string
}

export const tableNames = (options: RbacSchemaOptions = {}): RbacTableNames => {
  const prefix = options.prefix ?? ''
  return {
    permissions: `${prefix}permissions`,
    roles: `${prefix}roles`,
    roleHasPermissions: `${prefix}role_has_permissions`,
    modelHasRoles: `${prefix}model_has_roles`,
    modelHasPermissions: `${prefix}model_has_permissions`,
  }
}
