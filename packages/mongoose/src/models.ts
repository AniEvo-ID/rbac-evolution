import mongoose, { type Connection, type Model, Schema, type Types } from 'mongoose'

export interface PermissionDoc {
  _id: Types.ObjectId
  name: string
  guardName: string
  createdAt: Date
  updatedAt: Date
}

export interface RoleDoc {
  _id: Types.ObjectId
  name: string
  guardName: string
  /** `''` = global (no team). */
  teamId: string
  createdAt: Date
  updatedAt: Date
}

export interface RoleHasPermissionDoc {
  _id: Types.ObjectId
  roleId: Types.ObjectId
  permissionId: Types.ObjectId
}

export interface ModelHasRoleDoc {
  _id: Types.ObjectId
  roleId: Types.ObjectId
  subjectType: string
  subjectId: string
  /** `''` = global (no team). */
  teamId: string
}

export interface ModelHasPermissionDoc {
  _id: Types.ObjectId
  permissionId: Types.ObjectId
  subjectType: string
  subjectId: string
  /** `''` = global (no team). */
  teamId: string
}

/** The five Mongoose models used by the adapter. */
export interface RbacModels {
  Permission: Model<PermissionDoc>
  Role: Model<RoleDoc>
  RoleHasPermission: Model<RoleHasPermissionDoc>
  ModelHasRole: Model<ModelHasRoleDoc>
  ModelHasPermission: Model<ModelHasPermissionDoc>
}

export interface RbacModelOptions {
  /** Connection to register the models on. Default: the default `mongoose.connection`. */
  connection?: Connection
  /** Prepended to every collection name, e.g. `'rbac_'` → `rbac_permissions`. Default: `''`. */
  prefix?: string
}

export interface RbacCollectionNames {
  permissions: string
  roles: string
  roleHasPermissions: string
  modelHasRoles: string
  modelHasPermissions: string
}

export const collectionNames = (options: Pick<RbacModelOptions, 'prefix'> = {}): RbacCollectionNames => {
  const prefix = options.prefix ?? ''
  return {
    permissions: `${prefix}permissions`,
    roles: `${prefix}roles`,
    roleHasPermissions: `${prefix}role_has_permissions`,
    modelHasRoles: `${prefix}model_has_roles`,
    modelHasPermissions: `${prefix}model_has_permissions`,
  }
}

const linkOptions = { versionKey: false } as const

/** Schemas (unregistered). Useful to add plugins or hooks before calling `createRbacModels`. */
export function rbacSchemas() {
  const permission = new Schema<PermissionDoc>(
    {
      name: { type: String, required: true },
      guardName: { type: String, required: true },
    },
    { timestamps: true, versionKey: false },
  )
  permission.index({ name: 1, guardName: 1 }, { unique: true })

  const role = new Schema<RoleDoc>(
    {
      name: { type: String, required: true },
      guardName: { type: String, required: true },
      teamId: { type: String, default: '' },
    },
    { timestamps: true, versionKey: false },
  )
  role.index({ name: 1, guardName: 1, teamId: 1 }, { unique: true })

  const roleHasPermission = new Schema<RoleHasPermissionDoc>(
    {
      roleId: { type: Schema.Types.ObjectId, required: true },
      permissionId: { type: Schema.Types.ObjectId, required: true },
    },
    linkOptions,
  )
  roleHasPermission.index({ roleId: 1, permissionId: 1 }, { unique: true })
  roleHasPermission.index({ permissionId: 1 })

  const modelHasRole = new Schema<ModelHasRoleDoc>(
    {
      roleId: { type: Schema.Types.ObjectId, required: true },
      subjectType: { type: String, required: true },
      subjectId: { type: String, required: true },
      teamId: { type: String, default: '' },
    },
    linkOptions,
  )
  modelHasRole.index({ subjectType: 1, subjectId: 1, teamId: 1, roleId: 1 }, { unique: true })
  modelHasRole.index({ roleId: 1, subjectType: 1, teamId: 1 })

  const modelHasPermission = new Schema<ModelHasPermissionDoc>(
    {
      permissionId: { type: Schema.Types.ObjectId, required: true },
      subjectType: { type: String, required: true },
      subjectId: { type: String, required: true },
      teamId: { type: String, default: '' },
    },
    linkOptions,
  )
  modelHasPermission.index({ subjectType: 1, subjectId: 1, teamId: 1, permissionId: 1 }, { unique: true })
  modelHasPermission.index({ permissionId: 1, subjectType: 1, teamId: 1 })

  return { permission, role, roleHasPermission, modelHasRole, modelHasPermission }
}

const register = <T>(connection: Connection, collection: string, schema: Schema<T>): Model<T> => {
  // Model names are derived from the collection, so they never clash with your own `Role` / `Permission` models.
  const name = `rbac:${collection}`
  const existing = connection.models[name]
  return (existing as Model<T> | undefined) ?? connection.model<T>(name, schema, collection)
}

/**
 * Registers (or reuses) the rbac-evolution models on a connection.
 *
 * ```ts
 * const models = createRbacModels()                                   // default connection
 * const models = createRbacModels({ connection: conn, prefix: 'rbac_' })
 * ```
 */
export function createRbacModels(options: RbacModelOptions = {}): RbacModels {
  const connection = options.connection ?? mongoose.connection
  const names = collectionNames(options)
  const schemas = rbacSchemas()
  return {
    Permission: register(connection, names.permissions, schemas.permission),
    Role: register(connection, names.roles, schemas.role),
    RoleHasPermission: register(connection, names.roleHasPermissions, schemas.roleHasPermission),
    ModelHasRole: register(connection, names.modelHasRoles, schemas.modelHasRole),
    ModelHasPermission: register(connection, names.modelHasPermissions, schemas.modelHasPermission),
  }
}

/**
 * Creates the collections' indexes (unique constraints included). Call it once at deploy/startup when
 * Mongoose `autoIndex` is disabled; with `autoIndex` on (the default) the adapter waits for them itself.
 */
export async function syncRbacIndexes(models: RbacModels): Promise<void> {
  await Promise.all(Object.values(models).map((model: Model<unknown>) => model.createIndexes()))
}
