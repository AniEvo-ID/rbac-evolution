import type {
  ActiveLinkOptions,
  AttachLinkOptions,
  DeletedLinkCounts,
  FindPermissionsQuery,
  FindRolesQuery,
  Id,
  Permission,
  RbacAdapter,
  Role,
  RolePermissionLink,
  Subject,
  SubjectLinks,
  SubjectPermissionLink,
  SubjectRoleLink,
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

/** Options of `new MongooseRbacAdapter(models, options)`. */
export interface MongooseAdapterOptions {
  /**
   * Store an expiry per role assignment and direct permission, in the link documents' `expiresAt` field.
   * The models must declare that field (the ones of `createRbacModels()` / `rbacSchemas()` do, from 1.2).
   * Default: `false`: the adapter never reads or writes it.
   */
  expiry?: boolean | undefined
}

/** `expiresAt` of a lean link document (missing = permanent). */
const expiryOf = (doc: { expiresAt?: Date | null }): Date | null => doc.expiresAt ?? null

/**
 * Mongoose (MongoDB) implementation of `RbacAdapter`.
 * Construct it with `mongooseAdapter(options?)` or `new MongooseRbacAdapter(createRbacModels(...))`.
 */
export class MongooseRbacAdapter implements RbacAdapter {
  private ready: Promise<unknown> | undefined
  /** `true` with `{ expiry: true }`: the engine may then pass `expiresAt`. */
  readonly supportsExpiry: boolean

  constructor(
    readonly models: RbacModels,
    options: MongooseAdapterOptions = {},
  ) {
    this.supportsExpiry = options.expiry === true
    if (this.supportsExpiry) {
      // Mongoose strips fields its schema doesn't declare: without them, an expiry would silently not be stored.
      for (const model of [models.ModelHasRole, models.ModelHasPermission] as Model<unknown>[]) {
        if (model.schema.path('expiresAt') === undefined) {
          throw new TypeError(
            `rbac-evolution-mongoose: \`{ expiry: true }\` needs an \`expiresAt: Date\` field on ${model.modelName}.`,
          )
        }
      }
    }
  }

  /**
   * Waits for the models' indexes (unique constraints) once, before the first operation.
   * A failed attempt (e.g. a transient connection error) is forgotten, so the next call retries.
   */
  private init(): Promise<unknown> {
    this.ready ??= Promise.all(Object.values(this.models).map((model: Model<unknown>) => model.init())).catch(
      (error: unknown) => {
        this.ready = undefined
        throw error
      },
    )
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

  async attachSubjectRoles(
    subject: Subject,
    roleIds: readonly Id[],
    teamId: TeamId,
    options?: AttachLinkOptions,
  ): Promise<void> {
    const ids = toObjectIds(roleIds)
    if (ids.length === 0) return
    await this.init()
    const base = MongooseRbacAdapter.subjectFilter(subject, teamId)
    await MongooseRbacAdapter.upsertAll(
      this.models.ModelHasRole,
      ids.map((roleId) => ({ ...base, roleId })),
      this.expirySet(options),
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

  async attachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[],
    teamId: TeamId,
    options?: AttachLinkOptions,
  ): Promise<void> {
    const ids = toObjectIds(permissionIds)
    if (ids.length === 0) return
    await this.init()
    const base = MongooseRbacAdapter.subjectFilter(subject, teamId)
    await MongooseRbacAdapter.upsertAll(
      this.models.ModelHasPermission,
      ids.map((permissionId) => ({ ...base, permissionId })),
      this.expirySet(options),
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

  async getSubjectIdsWithRoles(
    subjectType: string,
    roleIds: readonly Id[],
    teamId: TeamId,
    options?: ActiveLinkOptions,
  ): Promise<Id[]> {
    const ids = toObjectIds(roleIds)
    if (ids.length === 0) return []
    await this.init()
    // $group streams through a cursor; `distinct` returns one document, capped at 16 MB (~400k ids).
    const rows: { _id: unknown }[] = await this.models.ModelHasRole.aggregate([
      { $match: { subjectType, teamId: teamKey(teamId), roleId: { $in: ids }, ...this.active(options) } },
      { $group: { _id: '$subjectId' } },
    ])
    return rows.map((r) => String(r._id))
  }

  async getSubjectIdsWithPermissions(
    subjectType: string,
    permissionIds: readonly Id[],
    teamId: TeamId,
    options?: ActiveLinkOptions,
  ): Promise<Id[]> {
    const ids = toObjectIds(permissionIds)
    if (ids.length === 0) return []
    await this.init()
    // $group streams through a cursor; `distinct` returns one document, capped at 16 MB (~400k ids).
    const rows: { _id: unknown }[] = await this.models.ModelHasPermission.aggregate([
      { $match: { subjectType, teamId: teamKey(teamId), permissionId: { $in: ids }, ...this.active(options) } },
      { $group: { _id: '$subjectId' } },
    ])
    return rows.map((r) => String(r._id))
  }

  // ----------------------------------------------------------- expiry (optional)

  async getSubjectRoleLinks(subject: Subject, teamId: TeamId): Promise<SubjectRoleLink[]> {
    return (await this.links(MongooseRbacAdapter.subjectFilter(subject, teamId))).roles
  }

  async getSubjectPermissionLinks(subject: Subject, teamId: TeamId): Promise<SubjectPermissionLink[]> {
    return (await this.links(MongooseRbacAdapter.subjectFilter(subject, teamId))).permissions
  }

  async deleteExpiredLinks(now: Date): Promise<DeletedLinkCounts> {
    if (!this.supportsExpiry) return { roles: 0, permissions: 0 }
    await this.init()
    const filter = { expiresAt: { $ne: null, $lte: now } }
    const roles = await this.models.ModelHasRole.deleteMany(filter)
    const permissions = await this.models.ModelHasPermission.deleteMany(filter)
    return { roles: roles.deletedCount, permissions: permissions.deletedCount }
  }

  /** `$set` of the expiry with `{ expiry: true }` (an attach without options writes a permanent link). */
  private expirySet(options: AttachLinkOptions | undefined): Record<string, unknown> | undefined {
    return this.supportsExpiry ? { expiresAt: options?.expiresAt ?? null } : undefined
  }

  /** Links still active at `now` (a missing field matches `null`), with expiry on and a `now`. */
  private active(options: ActiveLinkOptions | undefined): Record<string, unknown> {
    if (!this.supportsExpiry || !options) return {}
    return { $or: [{ expiresAt: null }, { expiresAt: { $gt: options.now } }] }
  }

  // ------------------------------------------------------------- bulk (optional)

  async getSubjectLinks(subject: Subject): Promise<SubjectLinks> {
    return this.links({ subjectType: subject.type, subjectId: String(subject.id) })
  }

  async getTeamLinks(teamId: Id): Promise<SubjectLinks> {
    const team = teamKey(teamId)
    if (team === GLOBAL_TEAM) return { roles: [], permissions: [] }
    return this.links({ teamId: team })
  }

  async detachTeamLinks(teamId: Id): Promise<void> {
    const team = teamKey(teamId)
    if (team === GLOBAL_TEAM) return
    await this.init()
    // String equality in MongoDB is exact (the collections have no collation), so the filter is enough.
    await this.models.ModelHasRole.deleteMany({ teamId: team })
    await this.models.ModelHasPermission.deleteMany({ teamId: team })
  }

  private async links(filter: Partial<SubjectLinkDoc>): Promise<SubjectLinks> {
    await this.init()
    // `expiresAt` is only read with `{ expiry: true }`; the links then look as in 1.1 otherwise.
    const projection = { subjectType: 1, subjectId: 1, teamId: 1, ...(this.supportsExpiry ? { expiresAt: 1 } : {}) }
    const roles = await this.models.ModelHasRole.find(filter, { ...projection, roleId: 1 }).lean()
    const permissions = await this.models.ModelHasPermission.find(filter, { ...projection, permissionId: 1 }).lean()
    const subject = (d: SubjectLinkDoc): Subject => ({ type: d.subjectType, id: d.subjectId })
    // The doc types have no `expiresAt` (it is optional and new in 1.2): read it from the lean document.
    const expiry = (d: object) => (this.supportsExpiry ? { expiresAt: expiryOf(d as { expiresAt?: Date | null }) } : {})
    return {
      roles: roles.map((d) => ({
        subject: subject(d),
        roleId: d.roleId.toHexString(),
        teamId: teamFromKey(d.teamId),
        ...expiry(d),
      })),
      permissions: permissions.map((d) => ({
        subject: subject(d),
        permissionId: d.permissionId.toHexString(),
        teamId: teamFromKey(d.teamId),
        ...expiry(d),
      })),
    }
  }

  // -------------------------------------------------------------------- helpers

  private static subjectFilter(subject: Subject, teamId: TeamId): SubjectLinkDoc {
    return { subjectType: subject.type, subjectId: String(subject.id), teamId: teamKey(teamId) }
  }

  /**
   * Idempotent insert: one upsert per link (`$setOnInsert`), matched on the unique key. `set` (the expiry)
   * is written to new and existing links alike: the latest attach wins.
   * A concurrent insert of the same link surfaces as a duplicate-key error, which is ignored.
   */
  private static async upsertAll<T>(
    model: Model<T>,
    docs: Record<string, unknown>[],
    set?: Record<string, unknown>,
  ): Promise<void> {
    const update = (doc: Record<string, unknown>) => (set ? { $setOnInsert: doc, $set: set } : { $setOnInsert: doc })
    try {
      await model.bulkWrite(
        docs.map((doc) => ({ updateOne: { filter: doc, update: update(doc), upsert: true } })) as never,
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
  return new MongooseRbacAdapter(createRbacModels(options), { expiry: options.expiry })
}
