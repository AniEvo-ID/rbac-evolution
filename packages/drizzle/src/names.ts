export interface RbacSchemaOptions {
  /** Prepended to every table name, e.g. `'rbac_'` → `rbac_permissions`. Default: `''`. */
  prefix?: string | undefined
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
