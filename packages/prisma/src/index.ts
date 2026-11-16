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
  skipDuplicates?: boolean
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

  constructor(prisma: PrismaRbacClient, options: PrismaAdapterOptions = {}) {
    this.#db = prisma
    this.#skipDuplicates = options.skipDuplicates ?? false
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

  async attachSubjectRoles(subject: Subject, roleIds: readonly Id[], teamId: TeamId): Promise<void> {
    const ids = requireIntIds(roleIds, 'role')
    if (ids.length === 0) return
    const base = this.#subjectWhere(subject, teamId)
    const delegate = this.#db.rbacModelHasRole
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

  async attachSubjectPermissions(subject: Subject, permissionIds: readonly Id[], teamId: TeamId): Promise<void> {
    const ids = requireIntIds(permissionIds, 'permission')
    if (ids.length === 0) return
    const base = this.#subjectWhere(subject, teamId)
    const delegate = this.#db.rbacModelHasPermission
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

  async getSubjectIdsWithRoles(subjectType: string, roleIds: readonly Id[], teamId: TeamId): Promise<Id[]> {
    const ids = toIntIds(roleIds)
    if (ids.length === 0) return []
    const where = { subjectType, teamId: teamKey(teamId) }
    const rows = await this.#db.rbacModelHasRole.groupBy({
      by: ['subjectType', 'subjectId', 'teamId'],
      where: { ...where, roleId: { in: ids } },
    })
    return unique(rows.filter((r) => sameSubject(r, where)).map((r) => r.subjectId))
  }

  async getSubjectIdsWithPermissions(subjectType: string, permissionIds: readonly Id[], teamId: TeamId): Promise<Id[]> {
    const ids = toIntIds(permissionIds)
    if (ids.length === 0) return []
    const where = { subjectType, teamId: teamKey(teamId) }
    const rows = await this.#db.rbacModelHasPermission.groupBy({
      by: ['subjectType', 'subjectId', 'teamId'],
      where: { ...where, permissionId: { in: ids } },
    })
    return unique(rows.filter((r) => sameSubject(r, where)).map((r) => r.subjectId))
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
