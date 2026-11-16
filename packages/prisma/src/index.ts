/**
 * @anievo-id/rbac-evolution-prisma
 *
 * Prisma storage adapter for rbac-evolution. Copy the models from `schema/rbac.prisma`
 * into your schema, run `prisma generate`, then:
 *
 * ```ts
 * import { createRbac } from '@anievo-id/rbac-evolution'
 * import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
 *
 * const rbac = createRbac({ adapter: new PrismaAdapter(prisma) })
 * ```
 */
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

// ------------------------------------------------------------------ structural client types
// Minimal shapes of the delegates generated from `schema/rbac.prisma`. They are structural so the
// adapter works with any generated client (any output path, extra models, client extensions).

type IntFilter = number | { in: number[] }
type StringFilter = string | { in: string[] }

export interface PrismaRbacPermissionRow {
  id: number
  name: string
  guardName: string
}

export interface PrismaRbacRoleRow {
  id: number
  name: string
  guardName: string
  teamId: string
}

export interface PrismaRbacRoleHasPermissionRow {
  roleId: number
  permissionId: number
}

export interface PrismaRbacModelHasRoleRow {
  roleId: number
  subjectType: string
  subjectId: string
  teamId: string
}

export interface PrismaRbacModelHasPermissionRow {
  permissionId: number
  subjectType: string
  subjectId: string
  teamId: string
}

interface BatchPayload {
  count: number
}

/** Generic subset of a Prisma model delegate used by the adapter. */
export interface PrismaRbacDelegate<Row, Where, Create, OrderBy = never> {
  findMany(args: { where?: Where; orderBy?: OrderBy }): PromiseLike<Row[]>
  create(args: { data: Create }): PromiseLike<Row>
  /** `skipDuplicates` is passed only when enabled (SQLite clients type it as `never`). */
  createMany(args: { data: Create[] }): PromiseLike<BatchPayload>
  deleteMany(args: { where: Where }): PromiseLike<BatchPayload>
}

export type PrismaRbacPermissionDelegate = PrismaRbacDelegate<
  PrismaRbacPermissionRow,
  { id?: IntFilter; name?: StringFilter; guardName?: string },
  { name: string; guardName: string },
  { id: 'asc' }
>

export type PrismaRbacRoleDelegate = PrismaRbacDelegate<
  PrismaRbacRoleRow,
  { id?: IntFilter; name?: StringFilter; guardName?: string; teamId?: StringFilter },
  { name: string; guardName: string; teamId: string },
  { id: 'asc' }
>

export type PrismaRbacRoleHasPermissionDelegate = PrismaRbacDelegate<
  PrismaRbacRoleHasPermissionRow,
  { roleId?: IntFilter; permissionId?: IntFilter },
  PrismaRbacRoleHasPermissionRow
>

/** `groupBy` on the subject links: the reverse lookups de-duplicate in the database, not in JS. */
export interface PrismaRbacSubjectGroupBy<Where> {
  groupBy(args: {
    by: ['subjectType', 'subjectId', 'teamId']
    where: Where
  }): PromiseLike<{ subjectType: string; subjectId: string; teamId: string }[]>
}

export type PrismaRbacModelHasRoleDelegate = PrismaRbacDelegate<
  PrismaRbacModelHasRoleRow,
  { roleId?: IntFilter; subjectType?: string; subjectId?: string; teamId?: string },
  PrismaRbacModelHasRoleRow
> &
  PrismaRbacSubjectGroupBy<{ roleId?: IntFilter; subjectType?: string; teamId?: string }>

export type PrismaRbacModelHasPermissionDelegate = PrismaRbacDelegate<
  PrismaRbacModelHasPermissionRow,
  { permissionId?: IntFilter; subjectType?: string; subjectId?: string; teamId?: string },
  PrismaRbacModelHasPermissionRow
> &
  PrismaRbacSubjectGroupBy<{ permissionId?: IntFilter; subjectType?: string; teamId?: string }>

/**
 * The subject-link delegates as the adapter uses them with `{ expiry: true }`. Kept out of the public types
 * above, so a client generated from the 1.1 models (no `expiresAt`) still matches `PrismaRbacClient`.
 */
type ExpiryFilter = null | { gt: Date } | { lte: Date }
interface ExpiryLinkDelegate {
  findMany(args: { where: Record<string, unknown> }): PromiseLike<(LinkRow & Record<string, unknown>)[]>
  createMany(args: { data: Record<string, unknown>[]; skipDuplicates?: boolean }): PromiseLike<BatchPayload>
  deleteMany(args: { where: Record<string, unknown> }): PromiseLike<BatchPayload>
  updateMany?(args: { where: Record<string, unknown>; data: { expiresAt: Date | null } }): PromiseLike<BatchPayload>
  groupBy(args: {
    by: ['subjectType', 'subjectId', 'teamId']
    where: Record<string, unknown>
  }): PromiseLike<{ subjectType: string; subjectId: string; teamId: string }[]>
}

/** The part of a `PrismaClient` (with the rbac models) that the adapter needs. */
export interface PrismaRbacClient {
  rbacPermission: PrismaRbacPermissionDelegate
  rbacRole: PrismaRbacRoleDelegate
  rbacRoleHasPermission: PrismaRbacRoleHasPermissionDelegate
  rbacModelHasRole: PrismaRbacModelHasRoleDelegate
  rbacModelHasPermission: PrismaRbacModelHasPermissionDelegate
  /** Missing on an interactive-transaction client (`prisma.$transaction(async (tx) => ...)`). */
  $transaction?(queries: PromiseLike<unknown>[]): PromiseLike<unknown>
}

export interface PrismaAdapterOptions {
  /**
   * Use `createMany({ skipDuplicates: true })` for attach operations (one query, race-free).
   * Supported by PostgreSQL, MySQL/MariaDB and CockroachDB — NOT by SQLite, SQL Server or MongoDB.
   * Default: `false` (portable: reads existing links first, inserts only the missing ones).
   */
  skipDuplicates?: boolean | undefined
  /**
   * Store an expiry per role assignment and direct permission (`assignRole(role, { expiresAt })`). Needs the
   * optional `expiresAt` field on `RbacModelHasRole` and `RbacModelHasPermission` (see `schema/rbac.prisma`
   * and the upgrade steps). Default: `false`: the adapter never reads or writes that field, so a 1.1 schema
   * keeps working unchanged.
   */
  expiry?: boolean | undefined
}

// ------------------------------------------------------------------------------- helpers

const GLOBAL_TEAM = ''

/** `null` (global) is stored as `''`; every other team id as text. */
const teamKey = (teamId: TeamId): string => (teamId === null ? GLOBAL_TEAM : String(teamId))
const teamFromKey = (key: string): TeamId => (key === GLOBAL_TEAM ? null : key)
const subjectKey = (subject: Subject): string => String(subject.id)

/** Converts an engine id (number or numeric string) into the Int primary key. */
const toIntId = (id: Id): number | undefined => {
  if (typeof id === 'number') return Number.isSafeInteger(id) ? id : undefined
  if (!/^-?\d+$/.test(id.trim())) return undefined
  const n = Number(id)
  return Number.isSafeInteger(n) ? n : undefined
}

const toIntIds = (ids: readonly Id[]): number[] => {
  const out = new Set<number>()
  for (const id of ids) {
    const n = toIntId(id)
    if (n !== undefined) out.add(n)
  }
  return [...out]
}

const requireIntIds = (ids: readonly Id[], what: string): number[] => {
  const out = new Set<number>()
  for (const id of ids) {
    const n = toIntId(id)
    if (n === undefined) throw new TypeError(`PrismaAdapter: invalid ${what} id ${JSON.stringify(id)} (expected an integer).`)
    out.add(n)
  }
  return [...out]
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'

const toPermission = (row: PrismaRbacPermissionRow): Permission => ({
  id: row.id,
  name: row.name,
  guardName: row.guardName,
})

const toRole = (row: PrismaRbacRoleRow): Role => ({
  id: row.id,
  name: row.name,
  guardName: row.guardName,
  teamId: teamFromKey(row.teamId),
})

const unique = (values: readonly string[]): string[] => [...new Set(values)]

/**
 * SQL compares text with the column's collation. Prisma can't set one on MySQL, so the database default
 * applies (`utf8mb4_0900_ai_ci` ignores case and accents), and SQL Server always ignores trailing spaces.
 * Every row read back is therefore checked again here, with exact string equality, so a subject `admin `
 * or `ADMIN` never gets the links of `admin`, whatever the collation.
 */
const sameSubject = (
  row: { subjectType: string; subjectId: string; teamId: string },
  where: { subjectType: string; subjectId?: string; teamId: string },
): boolean =>
  row.subjectType === where.subjectType &&
  (where.subjectId === undefined || row.subjectId === where.subjectId) &&
  row.teamId === where.teamId

type LinkRow = { subjectType: string; subjectId: string; teamId: string; expiresAt?: Date | null }

/** `{ expiresAt }` of a row when expiry is on (a missing field reads as permanent), else nothing (as in 1.1). */
const expiryOf = (row: LinkRow, expiry: boolean): { expiresAt?: Date | null } =>
  expiry ? { expiresAt: row.expiresAt ?? null } : {}

const toRoleLink = (r: LinkRow & { roleId: number }, expiry: boolean): SubjectRoleLink => ({
  subject: { type: r.subjectType, id: r.subjectId },
  roleId: r.roleId,
  teamId: teamFromKey(r.teamId),
  ...expiryOf(r, expiry),
})

const toPermissionLink = (p: LinkRow & { permissionId: number }, expiry: boolean): SubjectPermissionLink => ({
  subject: { type: p.subjectType, id: p.subjectId },
  permissionId: p.permissionId,
  teamId: teamFromKey(p.teamId),
  ...expiryOf(p, expiry),
})

const toSubjectLinks = (
  roles: readonly (LinkRow & { roleId: number })[],
  permissions: readonly (LinkRow & { permissionId: number })[],
  expiry: boolean,
): SubjectLinks => ({
  roles: roles.map((r) => toRoleLink(r, expiry)),
  permissions: permissions.map((p) => toPermissionLink(p, expiry)),
})

/** Links still active at `now`: no expiry, or one after `now`. */
const activeAt = (now: Date): { OR: { expiresAt: ExpiryFilter }[] } => ({
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
})

// ------------------------------------------------------------------------------- adapter

/**
 * `RbacAdapter` backed by Prisma. Requires the models from `schema/rbac.prisma`.
 *
 * - Role / permission ids are returned as numbers (numeric strings are accepted as input).
 * - Subject ids are stored as text; reverse lookups return them as strings.
 * - `Role.teamId` is `null` for global roles, otherwise the team id as a string.
 */
export class PrismaAdapter implements RbacAdapter {
  readonly #db: PrismaRbacClient
  readonly #skipDuplicates: boolean
  /** `true` with `{ expiry: true }`: the engine may then pass `expiresAt`. */
  readonly supportsExpiry: boolean

  constructor(prisma: PrismaRbacClient, options: PrismaAdapterOptions = {}) {
    this.#db = prisma
    this.#skipDuplicates = options.skipDuplicates ?? false
    this.supportsExpiry = options.expiry === true
  }

  /** A `tx` client is already inside a transaction: run the (lazy) queries in order instead. */
  async #atomically(queries: PromiseLike<unknown>[]): Promise<void> {
    if (this.#db.$transaction) {
      await this.#db.$transaction(queries)
      return
    }
    for (const query of queries) await query
  }

  // ---------------------------------------------------------------- permissions

  async createPermission(data: { name: string; guardName: string }): Promise<Permission> {
    const row = await this.#db.rbacPermission.create({ data: { name: data.name, guardName: data.guardName } })
    return toPermission(row)
  }

  async findPermissions(query: FindPermissionsQuery = {}): Promise<Permission[]> {
    const where: { id?: IntFilter; name?: StringFilter; guardName?: string } = {}
    if (query.ids !== undefined) {
      const ids = toIntIds(query.ids)
      if (ids.length === 0) return []
      where.id = { in: ids }
    }
    if (query.names !== undefined) {
      if (query.names.length === 0) return []
      where.name = { in: unique(query.names) }
    }
    if (query.guardName !== undefined) where.guardName = query.guardName

    const rows = await this.#db.rbacPermission.findMany({ where, orderBy: { id: 'asc' } })
    // Exact match, whatever the collation (see `sameSubject`).
    const names = query.names === undefined ? undefined : new Set(query.names)
    return rows
      .filter(
        (row) =>
          (names === undefined || names.has(row.name)) &&
          (query.guardName === undefined || row.guardName === query.guardName),
      )
      .map(toPermission)
  }

  async deletePermission(id: Id): Promise<void> {
    const permissionId = toIntId(id)
    if (permissionId === undefined) return
    await this.#atomically([
      this.#db.rbacRoleHasPermission.deleteMany({ where: { permissionId } }),
      this.#db.rbacModelHasPermission.deleteMany({ where: { permissionId } }),
      this.#db.rbacPermission.deleteMany({ where: { id: permissionId } }),
    ])
  }

  // ---------------------------------------------------------------------- roles

  async createRole(data: { name: string; guardName: string; teamId: TeamId }): Promise<Role> {
    const row = await this.#db.rbacRole.create({
      data: { name: data.name, guardName: data.guardName, teamId: teamKey(data.teamId) },
    })
    return toRole(row)
  }

  async findRoles(query: FindRolesQuery = {}): Promise<Role[]> {
    const where: { id?: IntFilter; name?: StringFilter; guardName?: string; teamId?: StringFilter } = {}
    if (query.ids !== undefined) {
      const ids = toIntIds(query.ids)
      if (ids.length === 0) return []
      where.id = { in: ids }
    }
    if (query.names !== undefined) {
      if (query.names.length === 0) return []
      where.name = { in: unique(query.names) }
    }
    if (query.guardName !== undefined) where.guardName = query.guardName
    const teams = query.teamIds === undefined ? undefined : new Set(query.teamIds.map(teamKey))
    if (teams !== undefined) {
      if (teams.size === 0) return []
      where.teamId = { in: [...teams] }
    }

    const rows = await this.#db.rbacRole.findMany({ where, orderBy: { id: 'asc' } })
    // Exact match, whatever the collation (see `sameSubject`).
    const names = query.names === undefined ? undefined : new Set(query.names)
    return rows
      .filter(
        (row) =>
          (names === undefined || names.has(row.name)) &&
          (query.guardName === undefined || row.guardName === query.guardName) &&
          (teams === undefined || teams.has(row.teamId)),
      )
      .map(toRole)
  }

  async deleteRole(id: Id): Promise<void> {
    const roleId = toIntId(id)
    if (roleId === undefined) return
    await this.#atomically([
      this.#db.rbacRoleHasPermission.deleteMany({ where: { roleId } }),
      this.#db.rbacModelHasRole.deleteMany({ where: { roleId } }),
      this.#db.rbacRole.deleteMany({ where: { id: roleId } }),
    ])
  }

  // ---------------------------------------------------------- role ↔ permission

  async getRolePermissionLinks(roleIds: readonly Id[]): Promise<RolePermissionLink[]> {
    const ids = toIntIds(roleIds)
    if (ids.length === 0) return []
    const rows = await this.#db.rbacRoleHasPermission.findMany({ where: { roleId: { in: ids } } })
    return rows.map((r) => ({ roleId: r.roleId, permissionId: r.permissionId }))
  }

  async attachRolePermissions(roleId: Id, permissionIds: readonly Id[]): Promise<void> {
    const [role] = requireIntIds([roleId], 'role')
    const ids = requireIntIds(permissionIds, 'permission')
    if (role === undefined || ids.length === 0) return
    const delegate = this.#db.rbacRoleHasPermission
    await this.#insertMissing(
      ids,
      async () => (await delegate.findMany({ where: { roleId: role, permissionId: { in: ids } } })).map((r) => r.permissionId),
      (data) => delegate.createMany({ data: data.map((permissionId) => ({ roleId: role, permissionId })), ...this.#skip() }),
    )
  }

  async detachRolePermissions(roleId: Id, permissionIds?: readonly Id[]): Promise<void> {
    const role = toIntId(roleId)
    if (role === undefined) return
    if (permissionIds === undefined) {
      await this.#db.rbacRoleHasPermission.deleteMany({ where: { roleId: role } })
      return
    }
    const ids = toIntIds(permissionIds)
    if (ids.length === 0) return
    await this.#db.rbacRoleHasPermission.deleteMany({ where: { roleId: role, permissionId: { in: ids } } })
  }

  // ------------------------------------------------------------- subject ↔ role

  async getSubjectRoleIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    const where = this.#subjectWhere(subject, teamId)
    const rows = await this.#db.rbacModelHasRole.findMany({ where })
    return rows.filter((r) => sameSubject(r, where)).map((r) => r.roleId)
  }

  async attachSubjectRoles(
    subject: Subject,
    roleIds: readonly Id[],
    teamId: TeamId,
    options?: AttachLinkOptions,
  ): Promise<void> {
    const ids = requireIntIds(roleIds, 'role')
    if (ids.length === 0) return
    const base = this.#subjectWhere(subject, teamId)
    const delegate = this.#db.rbacModelHasRole
    if (this.supportsExpiry) {
      await this.#attachWithExpiry('RbacModelHasRole', 'roleId', base, ids, options, () =>
        this.getSubjectRoleIds(subject, teamId),
      )
      return
    }
    await this.#insertMissing(
      ids,
      async () => (await delegate.findMany({ where: { ...base, roleId: { in: ids } } })).map((r) => r.roleId),
      (data) => delegate.createMany({ data: data.map((roleId) => ({ ...base, roleId })), ...this.#skip() }),
    )
  }

  async detachSubjectRoles(subject: Subject, roleIds: readonly Id[] | undefined, teamId: TeamId): Promise<void> {
    const ids = this.#heldIds(await this.getSubjectRoleIds(subject, teamId), roleIds)
    if (ids.length === 0) return
    const base = this.#subjectWhere(subject, teamId)
    await this.#db.rbacModelHasRole.deleteMany({ where: { ...base, roleId: { in: ids } } })
  }

  // ------------------------------------------------------- subject ↔ permission

  async getSubjectPermissionIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    const where = this.#subjectWhere(subject, teamId)
    const rows = await this.#db.rbacModelHasPermission.findMany({ where })
    return rows.filter((r) => sameSubject(r, where)).map((r) => r.permissionId)
  }

  async attachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[],
    teamId: TeamId,
    options?: AttachLinkOptions,
  ): Promise<void> {
    const ids = requireIntIds(permissionIds, 'permission')
    if (ids.length === 0) return
    const base = this.#subjectWhere(subject, teamId)
    const delegate = this.#db.rbacModelHasPermission
    if (this.supportsExpiry) {
      await this.#attachWithExpiry('RbacModelHasPermission', 'permissionId', base, ids, options, () =>
        this.getSubjectPermissionIds(subject, teamId),
      )
      return
    }
    await this.#insertMissing(
      ids,
      async () =>
        (await delegate.findMany({ where: { ...base, permissionId: { in: ids } } })).map((r) => r.permissionId),
      (data) => delegate.createMany({ data: data.map((permissionId) => ({ ...base, permissionId })), ...this.#skip() }),
    )
  }

  async detachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[] | undefined,
    teamId: TeamId,
  ): Promise<void> {
    const ids = this.#heldIds(await this.getSubjectPermissionIds(subject, teamId), permissionIds)
    if (ids.length === 0) return
    const base = this.#subjectWhere(subject, teamId)
    await this.#db.rbacModelHasPermission.deleteMany({ where: { ...base, permissionId: { in: ids } } })
  }

  // ------------------------------------------------------------ reverse lookups

  async getSubjectIdsWithRoles(
    subjectType: string,
    roleIds: readonly Id[],
    teamId: TeamId,
    options?: ActiveLinkOptions,
  ): Promise<Id[]> {
    const ids = toIntIds(roleIds)
    if (ids.length === 0) return []
    const where = { subjectType, teamId: teamKey(teamId) }
    const rows = await this.#links('RbacModelHasRole').groupBy({
      by: ['subjectType', 'subjectId', 'teamId'],
      where: { ...where, roleId: { in: ids }, ...this.#active(options) },
    })
    return unique(rows.filter((r) => sameSubject(r, where)).map((r) => r.subjectId))
  }

  async getSubjectIdsWithPermissions(
    subjectType: string,
    permissionIds: readonly Id[],
    teamId: TeamId,
    options?: ActiveLinkOptions,
  ): Promise<Id[]> {
    const ids = toIntIds(permissionIds)
    if (ids.length === 0) return []
    const where = { subjectType, teamId: teamKey(teamId) }
    const rows = await this.#links('RbacModelHasPermission').groupBy({
      by: ['subjectType', 'subjectId', 'teamId'],
      where: { ...where, permissionId: { in: ids }, ...this.#active(options) },
    })
    return unique(rows.filter((r) => sameSubject(r, where)).map((r) => r.subjectId))
  }

  // ------------------------------------------------------------- bulk (optional)

  async getSubjectLinks(subject: Subject): Promise<SubjectLinks> {
    const where = { subjectType: subject.type, subjectId: subjectKey(subject) }
    const exact = (row: { subjectType: string; subjectId: string }) =>
      row.subjectType === where.subjectType && row.subjectId === where.subjectId
    const roles = await this.#db.rbacModelHasRole.findMany({ where })
    const permissions = await this.#db.rbacModelHasPermission.findMany({ where })
    return toSubjectLinks(roles.filter(exact), permissions.filter(exact), this.supportsExpiry)
  }

  async getTeamLinks(teamId: Id): Promise<SubjectLinks> {
    const team = teamKey(teamId)
    if (team === GLOBAL_TEAM) return { roles: [], permissions: [] }
    // Exact match, whatever the collation (see `sameSubject`).
    const roles = await this.#db.rbacModelHasRole.findMany({ where: { teamId: team } })
    const permissions = await this.#db.rbacModelHasPermission.findMany({ where: { teamId: team } })
    return toSubjectLinks(
      roles.filter((r) => r.teamId === team),
      permissions.filter((p) => p.teamId === team),
      this.supportsExpiry,
    )
  }

  async detachTeamLinks(teamId: Id): Promise<void> {
    const team = teamKey(teamId)
    if (team === GLOBAL_TEAM) return
    // `teamId: 'acme'` alone would also delete the rows of a lookalike team (`ACME`, `acme `) under a
    // collation that ignores case or trailing spaces. So the rows are read back exactly, and deleted per
    // subject, restricted to the ids that subject holds in the team: exact, because the primary key stops
    // a lookalike team from holding the same subject and id (same reasoning as `#heldIds`).
    const { roles, permissions } = await this.getTeamLinks(teamId)
    const bySubject = <L extends { subject: Subject }>(links: readonly L[], id: (link: L) => Id) => {
      const out = new Map<string, { subjectType: string; subjectId: string; ids: number[] }>()
      for (const link of links) {
        const k = JSON.stringify([link.subject.type, String(link.subject.id)])
        const entry = out.get(k) ?? { subjectType: link.subject.type, subjectId: String(link.subject.id), ids: [] }
        entry.ids.push(...toIntIds([id(link)]))
        out.set(k, entry)
      }
      return [...out.values()]
    }
    await this.#atomically([
      ...bySubject(roles, (l) => l.roleId).map(({ subjectType, subjectId, ids }) =>
        this.#db.rbacModelHasRole.deleteMany({ where: { subjectType, subjectId, teamId: team, roleId: { in: ids } } }),
      ),
      ...bySubject(permissions, (l) => l.permissionId).map(({ subjectType, subjectId, ids }) =>
        this.#db.rbacModelHasPermission.deleteMany({
          where: { subjectType, subjectId, teamId: team, permissionId: { in: ids } },
        }),
      ),
    ])
  }

  // ----------------------------------------------------------- expiry (optional)

  async getSubjectRoleLinks(subject: Subject, teamId: TeamId): Promise<SubjectRoleLink[]> {
    const where = this.#subjectWhere(subject, teamId)
    const rows = await this.#db.rbacModelHasRole.findMany({ where })
    return rows.filter((r) => sameSubject(r, where)).map((r) => toRoleLink(r, this.supportsExpiry))
  }

  async getSubjectPermissionLinks(subject: Subject, teamId: TeamId): Promise<SubjectPermissionLink[]> {
    const where = this.#subjectWhere(subject, teamId)
    const rows = await this.#db.rbacModelHasPermission.findMany({ where })
    return rows.filter((r) => sameSubject(r, where)).map((r) => toPermissionLink(r, this.supportsExpiry))
  }

  async deleteExpiredLinks(now: Date): Promise<DeletedLinkCounts> {
    if (!this.supportsExpiry) return { roles: 0, permissions: 0 }
    const where = { expiresAt: { lte: now } satisfies ExpiryFilter }
    const roles = await this.#links('RbacModelHasRole').deleteMany({ where })
    const permissions = await this.#links('RbacModelHasPermission').deleteMany({ where })
    return { roles: roles.count, permissions: permissions.count }
  }

  /** A subject-link delegate, typed for the `expiresAt` field (only used with `{ expiry: true }`). */
  #links(model: 'RbacModelHasRole' | 'RbacModelHasPermission'): ExpiryLinkDelegate {
    const delegate = model === 'RbacModelHasRole' ? this.#db.rbacModelHasRole : this.#db.rbacModelHasPermission
    return delegate as unknown as ExpiryLinkDelegate
  }

  /** The "still active" filter for the reverse lookups, with expiry on and a `now`. */
  #active(options: ActiveLinkOptions | undefined): Record<string, unknown> {
    return this.supportsExpiry && options ? activeAt(options.now) : {}
  }

  /**
   * Attach with `{ expiry: true }`: inserts the missing links with the expiry (`null` without options), then
   * writes it to the links the exact subject already held: the latest call wins. Only ids read back for the
   * exact subject are updated, so a lookalike subject (another case, a trailing space) is never touched.
   */
  async #attachWithExpiry(
    model: 'RbacModelHasRole' | 'RbacModelHasPermission',
    target: 'roleId' | 'permissionId',
    base: { subjectType: string; subjectId: string; teamId: string },
    ids: number[],
    options: AttachLinkOptions | undefined,
    held: () => Promise<Id[]>,
  ): Promise<void> {
    const delegate = this.#links(model)
    const expiresAt = options?.expiresAt ?? null
    await this.#insertMissing(
      ids,
      async () =>
        (await delegate.findMany({ where: { ...base, [target]: { in: ids } } })).map((r) => Number(r[target])),
      (data) => delegate.createMany({ data: data.map((id) => ({ ...base, [target]: id, expiresAt })), ...this.#skip() }),
    )
    const update = this.#heldIds(await held(), ids)
    if (update.length === 0) return
    if (!delegate.updateMany) throw new TypeError(`PrismaAdapter: \`{ expiry: true }\` needs ${model}.updateMany().`)
    await delegate.updateMany({ where: { ...base, [target]: { in: update } }, data: { expiresAt } })
  }

  // -------------------------------------------------------------------- helpers

  #subjectWhere(subject: Subject, teamId: TeamId): { subjectType: string; subjectId: string; teamId: string } {
    return { subjectType: subject.type, subjectId: subjectKey(subject), teamId: teamKey(teamId) }
  }

  /**
   * The ids to delete: those the exact subject holds (`held`, already filtered by `sameSubject`), limited to
   * `wanted` when given. With a collation that ignores case or trailing spaces, deleting by subject alone
   * would also remove a lookalike's links; restricting the delete to ids the exact subject holds is exact,
   * because the primary key stops a lookalike from holding the same id.
   */
  #heldIds(held: readonly Id[], wanted: readonly Id[] | undefined): number[] {
    const have = toIntIds(held)
    if (wanted === undefined) return have
    const keep = new Set(toIntIds(wanted))
    return have.filter((id) => keep.has(id))
  }

  #skip(): { skipDuplicates?: boolean } {
    return this.#skipDuplicates ? { skipDuplicates: true } : {}
  }

  /**
   * Idempotent insert. With `skipDuplicates` it is a single `createMany`; otherwise the existing
   * links are read first and only the missing ones inserted. A concurrent insert of the same link
   * (unique violation P2002) is retried once, re-reading what now exists.
   */
  async #insertMissing(
    ids: number[],
    existing: () => Promise<number[]>,
    insert: (ids: number[]) => PromiseLike<BatchPayload>,
  ): Promise<void> {
    if (this.#skipDuplicates) {
      await insert(ids)
      return
    }
    for (let attempt = 0; ; attempt++) {
      const have = new Set(await existing())
      const missing = ids.filter((id) => !have.has(id))
      if (missing.length === 0) return
      try {
        await insert(missing)
        return
      } catch (error) {
        if (attempt >= 2 || !isUniqueViolation(error)) throw error
      }
    }
  }
}
