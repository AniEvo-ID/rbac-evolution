import type {
  FindPermissionsQuery,
  FindRolesQuery,
  Id,
  Permission,
  RbacAdapter,
  Role,
  RolePermissionLink,
  Subject,
  TeamId,
} from '@anievo-id/rbac-evolution'
import { type Model, Types } from 'mongoose'
import { type RbacModelOptions, type RbacModels, createRbacModels } from './models'

/** Team ids are stored as strings; `''` represents "no team" so it can be part of a unique index. */
const GLOBAL_TEAM = ''
const teamKey = (teamId: TeamId): string => (teamId === null ? GLOBAL_TEAM : String(teamId))
const teamFromKey = (key: string | undefined): TeamId => (key === undefined || key === GLOBAL_TEAM ? null : key)

/** Role / permission ids are ObjectIds (24 hex chars). Anything else can never match a document, so it is dropped. */
const OBJECT_ID = /^[0-9a-f]{24}$/i
const toObjectId = (id: Id): Types.ObjectId | null => {
  const s = String(id)
  return OBJECT_ID.test(s) ? new Types.ObjectId(s) : null
}
const toObjectIds = (ids: readonly Id[]): Types.ObjectId[] => {
  const out = new Map<string, Types.ObjectId>()
  for (const id of ids) {
    const oid = toObjectId(id)
    if (oid !== null) out.set(oid.toHexString(), oid)
  }
  return [...out.values()]
}

/** True when every failure of a (bulk) write is a duplicate-key error, i.e. the link already existed. */
const onlyDuplicates = (error: unknown): boolean => {
  const e = error as { code?: unknown; writeErrors?: unknown; writeConcernErrors?: unknown } | null
  if (e === null || typeof e !== 'object') return false
  const writeErrors = Array.isArray(e.writeErrors) ? (e.writeErrors as { code?: unknown }[]) : []
  if (Array.isArray(e.writeConcernErrors) && e.writeConcernErrors.length > 0) return false
  if (writeErrors.length > 0) return writeErrors.every((w) => w.code === 11000)
  return e.code === 11000
}

type SubjectLinkDoc = {
  subjectType: string
  subjectId: string
  teamId: string
}

/**
 * Mongoose (MongoDB) implementation of `RbacAdapter`.
 * Construct it with `mongooseAdapter(options?)` or `new MongooseRbacAdapter(createRbacModels(...))`.
 */
export class MongooseRbacAdapter implements RbacAdapter {
  private ready: Promise<unknown> | undefined

  constructor(readonly models: RbacModels) {}

  /** Waits for the models' indexes (unique constraints) once, before the first operation. */
  private init(): Promise<unknown> {
    this.ready ??= Promise.all(Object.values(this.models).map((model: Model<unknown>) => model.init()))
    return this.ready
  }

  // ---------------------------------------------------------------- permissions

  async createPermission(data: { name: string; guardName: string }): Promise<Permission> {
    await this.init()
    const doc = await this.models.Permission.create({ name: data.name, guardName: data.guardName })
    return { id: doc._id.toHexString(), name: doc.name, guardName: doc.guardName }
  }

  async findPermissions(query: FindPermissionsQuery = {}): Promise<Permission[]> {
    await this.init()
    const filter: Record<string, unknown> = {}
    if (query.ids !== undefined) {
      const ids = toObjectIds(query.ids)
      if (ids.length === 0) return []
      filter._id = { $in: ids }
    }
    if (query.names !== undefined) {
      if (query.names.length === 0) return []
      filter.name = { $in: [...query.names] }
    }
    if (query.guardName !== undefined) filter.guardName = query.guardName
    const docs = await this.models.Permission.find(filter, { name: 1, guardName: 1 }).sort({ _id: 1 }).lean()
    return docs.map((d) => ({ id: d._id.toHexString(), name: d.name, guardName: d.guardName }))
  }

  async deletePermission(id: Id): Promise<void> {
    const pid = toObjectId(id)
    if (pid === null) return
    await this.init()
    await this.models.RoleHasPermission.deleteMany({ permissionId: pid })
    await this.models.ModelHasPermission.deleteMany({ permissionId: pid })
    await this.models.Permission.deleteOne({ _id: pid })
  }

  // ---------------------------------------------------------------------- roles

  async createRole(data: { name: string; guardName: string; teamId: TeamId }): Promise<Role> {
    await this.init()
    const doc = await this.models.Role.create({ name: data.name, guardName: data.guardName, teamId: teamKey(data.teamId) })
    return { id: doc._id.toHexString(), name: doc.name, guardName: doc.guardName, teamId: teamFromKey(doc.teamId) }
  }

  async findRoles(query: FindRolesQuery = {}): Promise<Role[]> {
    await this.init()
    const filter: Record<string, unknown> = {}
    if (query.ids !== undefined) {
      const ids = toObjectIds(query.ids)
      if (ids.length === 0) return []
      filter._id = { $in: ids }
    }
    if (query.names !== undefined) {
      if (query.names.length === 0) return []
      filter.name = { $in: [...query.names] }
    }
    if (query.guardName !== undefined) filter.guardName = query.guardName
    if (query.teamIds !== undefined) {
      if (query.teamIds.length === 0) return []
      const teams = [...new Set(query.teamIds.map(teamKey))]
      // Documents written without the field (e.g. by hand) count as global.
      filter.teamId = teams.includes(GLOBAL_TEAM) ? { $in: [...teams, null] } : { $in: teams }
    }
    const docs = await this.models.Role.find(filter, { name: 1, guardName: 1, teamId: 1 }).sort({ _id: 1 }).lean()
    return docs.map((d) => ({
      id: d._id.toHexString(),
      name: d.name,
      guardName: d.guardName,
      teamId: teamFromKey(d.teamId),
    }))
  }

  async deleteRole(id: Id): Promise<void> {
    const rid = toObjectId(id)
    if (rid === null) return
    await this.init()
    await this.models.RoleHasPermission.deleteMany({ roleId: rid })
    await this.models.ModelHasRole.deleteMany({ roleId: rid })
    await this.models.Role.deleteOne({ _id: rid })
  }

  // ---------------------------------------------------------- role ↔ permission

  async getRolePermissionLinks(roleIds: readonly Id[]): Promise<RolePermissionLink[]> {
    const ids = toObjectIds(roleIds)
    if (ids.length === 0) return []
    await this.init()
    const docs = await this.models.RoleHasPermission.find({ roleId: { $in: ids } }, { roleId: 1, permissionId: 1 }).lean()
    return docs.map((d) => ({ roleId: d.roleId.toHexString(), permissionId: d.permissionId.toHexString() }))
  }

  async attachRolePermissions(roleId: Id, permissionIds: readonly Id[]): Promise<void> {
    const rid = toObjectId(roleId)
    const ids = toObjectIds(permissionIds)
    if (rid === null || ids.length === 0) return
    await this.init()
    await MongooseRbacAdapter.upsertAll(
      this.models.RoleHasPermission,
      ids.map((permissionId) => ({ roleId: rid, permissionId })),
    )
  }

  async detachRolePermissions(roleId: Id, permissionIds?: readonly Id[]): Promise<void> {
    const rid = toObjectId(roleId)
    if (rid === null) return
    const filter: Record<string, unknown> = { roleId: rid }
    if (permissionIds !== undefined) {
      const ids = toObjectIds(permissionIds)
      if (ids.length === 0) return
      filter.permissionId = { $in: ids }
    }
    await this.init()
    await this.models.RoleHasPermission.deleteMany(filter)
  }

  // ------------------------------------------------------------- subject links

  async getSubjectRoleIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    await this.init()
    const docs = await this.models.ModelHasRole.find(MongooseRbacAdapter.subjectFilter(subject, teamId), {
      roleId: 1,
    }).lean()
    return docs.map((d) => d.roleId.toHexString())
  }

  async attachSubjectRoles(subject: Subject, roleIds: readonly Id[], teamId: TeamId): Promise<void> {
    const ids = toObjectIds(roleIds)
    if (ids.length === 0) return
    await this.init()
    const base = MongooseRbacAdapter.subjectFilter(subject, teamId)
    await MongooseRbacAdapter.upsertAll(
      this.models.ModelHasRole,
      ids.map((roleId) => ({ ...base, roleId })),
    )
  }

  async detachSubjectRoles(subject: Subject, roleIds: readonly Id[] | undefined, teamId: TeamId): Promise<void> {
    const filter: Record<string, unknown> = MongooseRbacAdapter.subjectFilter(subject, teamId)
    if (roleIds !== undefined) {
      const ids = toObjectIds(roleIds)
      if (ids.length === 0) return
      filter.roleId = { $in: ids }
    }
    await this.init()
    await this.models.ModelHasRole.deleteMany(filter)
  }

  async getSubjectPermissionIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    await this.init()
    const docs = await this.models.ModelHasPermission.find(MongooseRbacAdapter.subjectFilter(subject, teamId), {
      permissionId: 1,
    }).lean()
    return docs.map((d) => d.permissionId.toHexString())
  }

  async attachSubjectPermissions(subject: Subject, permissionIds: readonly Id[], teamId: TeamId): Promise<void> {
    const ids = toObjectIds(permissionIds)
    if (ids.length === 0) return
    await this.init()
    const base = MongooseRbacAdapter.subjectFilter(subject, teamId)
    await MongooseRbacAdapter.upsertAll(
      this.models.ModelHasPermission,
      ids.map((permissionId) => ({ ...base, permissionId })),
    )
  }

  async detachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[] | undefined,
    teamId: TeamId,
  ): Promise<void> {
    const filter: Record<string, unknown> = MongooseRbacAdapter.subjectFilter(subject, teamId)
    if (permissionIds !== undefined) {
      const ids = toObjectIds(permissionIds)
      if (ids.length === 0) return
      filter.permissionId = { $in: ids }
    }
    await this.init()
    await this.models.ModelHasPermission.deleteMany(filter)
  }

  async getSubjectIdsWithRoles(subjectType: string, roleIds: readonly Id[], teamId: TeamId): Promise<Id[]> {
    const ids = toObjectIds(roleIds)
    if (ids.length === 0) return []
    await this.init()
    const subjectIds: unknown[] = await this.models.ModelHasRole.distinct('subjectId', {
      subjectType,
      teamId: teamKey(teamId),
      roleId: { $in: ids },
    })
    return subjectIds.map(String)
  }

  async getSubjectIdsWithPermissions(subjectType: string, permissionIds: readonly Id[], teamId: TeamId): Promise<Id[]> {
    const ids = toObjectIds(permissionIds)
    if (ids.length === 0) return []
    await this.init()
    const subjectIds: unknown[] = await this.models.ModelHasPermission.distinct('subjectId', {
      subjectType,
      teamId: teamKey(teamId),
      permissionId: { $in: ids },
    })
    return subjectIds.map(String)
  }

  // -------------------------------------------------------------------- helpers

  private static subjectFilter(subject: Subject, teamId: TeamId): SubjectLinkDoc {
    return { subjectType: subject.type, subjectId: String(subject.id), teamId: teamKey(teamId) }
  }

  /**
   * Idempotent insert: one upsert per link (`$setOnInsert`), matched on the unique key.
   * A concurrent insert of the same link surfaces as a duplicate-key error, which is ignored.
   */
  private static async upsertAll<T>(model: Model<T>, docs: Record<string, unknown>[]): Promise<void> {
    try {
      await model.bulkWrite(
        docs.map((doc) => ({ updateOne: { filter: doc, update: { $setOnInsert: doc }, upsert: true } })) as never,
        { ordered: false },
      )
    } catch (error) {
      if (!onlyDuplicates(error)) throw error
    }
  }
}

/**
 * Creates a Mongoose-backed `RbacAdapter` (registers the models on the connection if needed).
 *
 * ```ts
 * await mongoose.connect(process.env.MONGO_URL!)
 * const rbac = createRbac({ adapter: mongooseAdapter() })
 * const rbac = createRbac({ adapter: mongooseAdapter({ connection: conn, prefix: 'rbac_' }) })
 * ```
 */
export function mongooseAdapter(options: RbacModelOptions = {}): MongooseRbacAdapter {
  return new MongooseRbacAdapter(createRbacModels(options))
}
