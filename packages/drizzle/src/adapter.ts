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
import { type AnyColumn, type SQL, type Table, and, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm'

/** Structural shape shared by the PostgreSQL, SQLite and MySQL schemas. */
export interface RbacTables {
  permissions: Table & { id: AnyColumn; name: AnyColumn; guardName: AnyColumn }
  roles: Table & { id: AnyColumn; name: AnyColumn; guardName: AnyColumn; teamId: AnyColumn }
  roleHasPermissions: Table & { roleId: AnyColumn; permissionId: AnyColumn }
  /** `expiresAt` only in a schema built with `{ expiry: true }`. */
  modelHasRoles: Table & {
    roleId: AnyColumn
    subjectType: AnyColumn
    subjectId: AnyColumn
    teamId: AnyColumn
    expiresAt?: AnyColumn
  }
  modelHasPermissions: Table & {
    permissionId: AnyColumn
    subjectType: AnyColumn
    subjectId: AnyColumn
    teamId: AnyColumn
    expiresAt?: AnyColumn
  }
}

/** Options of `drizzlePgAdapter()`, `drizzleSqliteAdapter()` and `drizzleMysqlAdapter()`. */
export interface DrizzleAdapterOptions {
  /**
   * Store an expiry per role assignment and direct permission (`assignRole(role, { expiresAt })`). Needs the
   * schema built with `{ expiry: true }` and the `expires_at` column in the database (`sql/<dialect>-expiry.sql`).
   * Default: `false`: the adapter never reads or writes that column, so 1.1 tables keep working unchanged.
   */
  expiry?: boolean | undefined
}

/**
 * The PostgreSQL, SQLite and MySQL query builders expose the same chainable API
 * (`select/insert/delete`, `selectDistinct`) but have incompatible static types. The public factories
 * (`drizzlePgAdapter`, `drizzleSqliteAdapter`, `drizzleMysqlAdapter`) are strictly typed; internally the
 * builder is used untyped and every row is mapped explicitly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UntypedDb = any

/**
 * SQL dialect of the Drizzle database. It only changes how inserts are written:
 * - `'pg'` / `'sqlite'`: `INSERT ... RETURNING` and `ON CONFLICT DO NOTHING`
 * - `'mysql'`: `$returningId()` (no `RETURNING` in MySQL) and a no-op `ON DUPLICATE KEY UPDATE`
 */
export type DrizzleDialect = 'pg' | 'sqlite' | 'mysql'

interface PermissionRow {
  id: number
  name: string
  guardName: string
}

interface RoleRow extends PermissionRow {
  teamId: string
}

/** Team ids are stored as text; `''` represents "no team" so it can live in a composite primary key. */
const GLOBAL_TEAM = ''
const teamKey = (teamId: TeamId): string => (teamId === null ? GLOBAL_TEAM : String(teamId))
const teamFromKey = (key: string): TeamId => (key === GLOBAL_TEAM ? null : key)

/**
 * Role / permission ids are integers. Ids that are not plain integers can never match a row, so they are dropped.
 * Strings must be written as integers: `'1e3'`, `'0x1A'` or `'1.0'` are not ids (same rule as the Prisma adapter).
 */
const toIntId = (id: Id): number | null => {
  if (typeof id === 'number') return Number.isSafeInteger(id) ? id : null
  if (!/^-?\d+$/.test(id.trim())) return null
  const n = Number(id)
  return Number.isSafeInteger(n) ? n : null
}
const toIntIds = (ids: readonly Id[]): number[] => {
  const out = new Set<number>()
  for (const id of ids) {
    const n = toIntId(id)
    if (n !== null) out.add(n)
  }
  return [...out]
}

const toPermission = (row: PermissionRow): Permission => ({
  id: Number(row.id),
  name: row.name,
  guardName: row.guardName,
})

const toRole = (row: RoleRow): Role => ({
  id: Number(row.id),
  name: row.name,
  guardName: row.guardName,
  teamId: teamFromKey(row.teamId),
})

type SubjectTable = RbacTables['modelHasRoles'] | RbacTables['modelHasPermissions']

interface LinkRow {
  id: number
  subjectType: string
  subjectId: string
  teamId: string
  /** Only selected with `{ expiry: true }`. */
  expiresAt?: Date | null
}

/** `{ expiresAt }` when it was selected (expiry on), else nothing: the links then look as in 1.1. */
const expiryOf = (row: LinkRow): { expiresAt?: Date | null } =>
  row.expiresAt === undefined ? {} : { expiresAt: row.expiresAt ?? null }

const toRoleLink = (row: LinkRow): SubjectRoleLink => ({
  subject: { type: row.subjectType, id: row.subjectId },
  roleId: Number(row.id),
  teamId: teamFromKey(row.teamId),
  ...expiryOf(row),
})

const toPermissionLink = (row: LinkRow): SubjectPermissionLink => ({
  subject: { type: row.subjectType, id: row.subjectId },
  permissionId: Number(row.id),
  teamId: teamFromKey(row.teamId),
  ...expiryOf(row),
})

/**
 * SQL compares text with the column's collation, which can ignore case or accents (MySQL's default
 * `utf8mb4_0900_ai_ci`) or trailing spaces (MySQL's `utf8mb4_bin` is PAD SPACE, SQL Server always pads).
 * Every row read back is therefore checked again here, with exact string equality, so a subject `admin `
 * or `ADMIN` never gets the links of `admin`, whatever the schema's collation.
 */
const sameLink = (
  row: Omit<LinkRow, 'id'>,
  subjectType: string,
  subjectId: string | undefined,
  team: string,
): boolean =>
  row.subjectType === subjectType && (subjectId === undefined || row.subjectId === subjectId) && row.teamId === team

/**
 * Dialect-agnostic Drizzle implementation of `RbacAdapter`.
 * Use `drizzlePgAdapter()`, `drizzleSqliteAdapter()` or `drizzleMysqlAdapter()` to construct it.
 */
export class DrizzleRbacAdapter implements RbacAdapter {
  /** `true` with `{ expiry: true }`: the engine may then pass `expiresAt`. */
  readonly supportsExpiry: boolean

  constructor(
    private readonly db: UntypedDb,
    private readonly t: RbacTables,
    private readonly dialect: DrizzleDialect = 'pg',
    options: DrizzleAdapterOptions = {},
  ) {
    this.supportsExpiry = options.expiry === true
    if (this.supportsExpiry && (t.modelHasRoles.expiresAt === undefined || t.modelHasPermissions.expiresAt === undefined)) {
      throw new TypeError(
        'rbac-evolution-drizzle: `{ expiry: true }` needs the tables with the `expiresAt` column: build them with `{ expiry: true }`.',
      )
    }
  }

  /**
   * Runs `fn` in a transaction (a savepoint when `db` is already a transaction). SQLite runs without one:
   * better-sqlite3 and bun:sqlite only accept synchronous transaction callbacks, and libsql `:memory:` would
   * open a separate, empty database.
   */
  private atomically(fn: (db: UntypedDb) => Promise<void>): Promise<void> {
    if (this.dialect === 'sqlite') return fn(this.db)
    return this.db.transaction(fn)
  }

  // ---------------------------------------------------------------- permissions

  async createPermission(data: { name: string; guardName: string }): Promise<Permission> {
    const { permissions: p } = this.t
    const values = { name: data.name, guardName: data.guardName }
    if (this.dialect === 'mysql') return { id: await this.insertReturningId(p, values), ...values }
    const rows: PermissionRow[] = await this.db
      .insert(p)
      .values(values)
      .returning({ id: p.id, name: p.name, guardName: p.guardName })
    return toPermission(DrizzleRbacAdapter.first(rows))
  }

  async findPermissions(query: FindPermissionsQuery = {}): Promise<Permission[]> {
    const { permissions: p } = this.t
    const where: SQL[] = []
    if (query.ids !== undefined) {
      const ids = toIntIds(query.ids)
      if (ids.length === 0) return []
      where.push(inArray(p.id, ids))
    }
    if (query.names !== undefined) {
      if (query.names.length === 0) return []
      where.push(inArray(p.name, [...query.names]))
    }
    if (query.guardName !== undefined) where.push(eq(p.guardName, query.guardName))

    const rows: PermissionRow[] = await this.db
      .select({ id: p.id, name: p.name, guardName: p.guardName })
      .from(p)
      .where(and(...where))
      .orderBy(p.id)
    // Exact match, whatever the collation (see `sameLink`).
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
    const pid = toIntId(id)
    if (pid === null) return
    const { permissions, roleHasPermissions, modelHasPermissions } = this.t
    // Links are removed explicitly: FK cascades may be disabled (e.g. SQLite without `PRAGMA foreign_keys`).
    // One transaction, so a failure can't leave roles without a permission that still exists.
    await this.atomically(async (db) => {
      await db.delete(roleHasPermissions).where(eq(roleHasPermissions.permissionId, pid))
      await db.delete(modelHasPermissions).where(eq(modelHasPermissions.permissionId, pid))
      await db.delete(permissions).where(eq(permissions.id, pid))
    })
  }

  // ---------------------------------------------------------------------- roles

  async createRole(data: { name: string; guardName: string; teamId: TeamId }): Promise<Role> {
    const { roles: r } = this.t
    const values = { name: data.name, guardName: data.guardName, teamId: teamKey(data.teamId) }
    if (this.dialect === 'mysql') return toRole({ id: await this.insertReturningId(r, values), ...values })
    const rows: RoleRow[] = await this.db
      .insert(r)
      .values(values)
      .returning({ id: r.id, name: r.name, guardName: r.guardName, teamId: r.teamId })
    return toRole(DrizzleRbacAdapter.first(rows))
  }

  async findRoles(query: FindRolesQuery = {}): Promise<Role[]> {
    const { roles: r } = this.t
    const where: SQL[] = []
    if (query.ids !== undefined) {
      const ids = toIntIds(query.ids)
      if (ids.length === 0) return []
      where.push(inArray(r.id, ids))
    }
    if (query.names !== undefined) {
      if (query.names.length === 0) return []
      where.push(inArray(r.name, [...query.names]))
    }
    if (query.guardName !== undefined) where.push(eq(r.guardName, query.guardName))
    const teams = query.teamIds === undefined ? undefined : new Set(query.teamIds.map(teamKey))
    if (teams !== undefined) {
      if (teams.size === 0) return []
      where.push(inArray(r.teamId, [...teams]))
    }

    const rows: RoleRow[] = await this.db
      .select({ id: r.id, name: r.name, guardName: r.guardName, teamId: r.teamId })
      .from(r)
      .where(and(...where))
      .orderBy(r.id)
    // Exact match, whatever the collation (see `sameLink`).
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
    const rid = toIntId(id)
    if (rid === null) return
    const { roles, roleHasPermissions, modelHasRoles } = this.t
    await this.atomically(async (db) => {
      await db.delete(roleHasPermissions).where(eq(roleHasPermissions.roleId, rid))
      await db.delete(modelHasRoles).where(eq(modelHasRoles.roleId, rid))
      await db.delete(roles).where(eq(roles.id, rid))
    })
  }

  // ---------------------------------------------------------- role ↔ permission

  async getRolePermissionLinks(roleIds: readonly Id[]): Promise<RolePermissionLink[]> {
    const ids = toIntIds(roleIds)
    if (ids.length === 0) return []
    const { roleHasPermissions: l } = this.t
    const rows: { roleId: number; permissionId: number }[] = await this.db
      .select({ roleId: l.roleId, permissionId: l.permissionId })
      .from(l)
      .where(inArray(l.roleId, ids))
    return rows.map((row) => ({ roleId: Number(row.roleId), permissionId: Number(row.permissionId) }))
  }

  async attachRolePermissions(roleId: Id, permissionIds: readonly Id[]): Promise<void> {
    const rid = toIntId(roleId)
    const ids = toIntIds(permissionIds)
    if (rid === null || ids.length === 0) return
    const { roleHasPermissions: l } = this.t
    await this.insertIgnoringDuplicates(
      l,
      ids.map((permissionId) => ({ roleId: rid, permissionId })),
      'roleId',
      l.roleId,
    )
  }

  async detachRolePermissions(roleId: Id, permissionIds?: readonly Id[]): Promise<void> {
    const rid = toIntId(roleId)
    if (rid === null) return
    const { roleHasPermissions: l } = this.t
    if (permissionIds === undefined) {
      await this.db.delete(l).where(eq(l.roleId, rid))
      return
    }
    const ids = toIntIds(permissionIds)
    if (ids.length === 0) return
    await this.db.delete(l).where(and(eq(l.roleId, rid), inArray(l.permissionId, ids)))
  }

  // ------------------------------------------------------------- subject links

  getSubjectRoleIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    return this.getLinks(this.t.modelHasRoles, this.t.modelHasRoles.roleId, subject, teamId)
  }

  attachSubjectRoles(
    subject: Subject,
    roleIds: readonly Id[],
    teamId: TeamId,
    options?: AttachLinkOptions,
  ): Promise<void> {
    return this.attach(this.t.modelHasRoles, 'roleId', this.t.modelHasRoles.roleId, subject, roleIds, teamId, options)
  }

  detachSubjectRoles(subject: Subject, roleIds: readonly Id[] | undefined, teamId: TeamId): Promise<void> {
    return this.detach(this.t.modelHasRoles, this.t.modelHasRoles.roleId, subject, roleIds, teamId)
  }

  getSubjectPermissionIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    return this.getLinks(this.t.modelHasPermissions, this.t.modelHasPermissions.permissionId, subject, teamId)
  }

  attachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[],
    teamId: TeamId,
    options?: AttachLinkOptions,
  ): Promise<void> {
    const { modelHasPermissions: table } = this.t
    return this.attach(table, 'permissionId', table.permissionId, subject, permissionIds, teamId, options)
  }

  detachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[] | undefined,
    teamId: TeamId,
  ): Promise<void> {
    return this.detach(
      this.t.modelHasPermissions,
      this.t.modelHasPermissions.permissionId,
      subject,
      permissionIds,
      teamId,
    )
  }

  getSubjectIdsWithRoles(
    subjectType: string,
    roleIds: readonly Id[],
    teamId: TeamId,
    options?: ActiveLinkOptions,
  ): Promise<Id[]> {
    return this.reverse(this.t.modelHasRoles, this.t.modelHasRoles.roleId, subjectType, roleIds, teamId, options)
  }

  getSubjectIdsWithPermissions(
    subjectType: string,
    permissionIds: readonly Id[],
    teamId: TeamId,
    options?: ActiveLinkOptions,
  ): Promise<Id[]> {
    return this.reverse(
      this.t.modelHasPermissions,
      this.t.modelHasPermissions.permissionId,
      subjectType,
      permissionIds,
      teamId,
      options,
    )
  }

  // ----------------------------------------------------------- expiry (optional)

  async getSubjectRoleLinks(subject: Subject, teamId: TeamId): Promise<SubjectRoleLink[]> {
    return (await this.linkRows(this.t.modelHasRoles, this.t.modelHasRoles.roleId, subject, teamId)).map(toRoleLink)
  }

  async getSubjectPermissionLinks(subject: Subject, teamId: TeamId): Promise<SubjectPermissionLink[]> {
    const { modelHasPermissions: table } = this.t
    return (await this.linkRows(table, table.permissionId, subject, teamId)).map(toPermissionLink)
  }

  async deleteExpiredLinks(now: Date): Promise<DeletedLinkCounts> {
    if (!this.supportsExpiry) return { roles: 0, permissions: 0 }
    const remove = async (table: SubjectTable, target: AnyColumn): Promise<number> => {
      const query = this.db.delete(table).where(lte(table.expiresAt!, now))
      if (this.dialect !== 'mysql') return (await query.returning({ id: target })).length
      // mysql2: [ResultSetHeader]; PlanetScale / TiDB serverless: { rowsAffected }.
      const result: unknown = await query
      const header = (Array.isArray(result) ? result[0] : result) as { affectedRows?: number; rowsAffected?: number }
      return Number(header?.affectedRows ?? header?.rowsAffected ?? 0)
    }
    return {
      roles: await remove(this.t.modelHasRoles, this.t.modelHasRoles.roleId),
      permissions: await remove(this.t.modelHasPermissions, this.t.modelHasPermissions.permissionId),
    }
  }

  // ------------------------------------------------------------- bulk (optional)

  async getSubjectLinks(subject: Subject): Promise<SubjectLinks> {
    const where = { subjectType: subject.type, subjectId: String(subject.id) }
    return DrizzleRbacAdapter.toSubjectLinks(
      await this.exactRows(this.db, this.t.modelHasRoles, this.t.modelHasRoles.roleId, where),
      await this.exactRows(this.db, this.t.modelHasPermissions, this.t.modelHasPermissions.permissionId, where),
    )
  }

  async getTeamLinks(teamId: Id): Promise<SubjectLinks> {
    const team = teamKey(teamId)
    if (team === GLOBAL_TEAM) return { roles: [], permissions: [] }
    return DrizzleRbacAdapter.toSubjectLinks(
      await this.exactRows(this.db, this.t.modelHasRoles, this.t.modelHasRoles.roleId, { teamId: team }),
      await this.exactRows(this.db, this.t.modelHasPermissions, this.t.modelHasPermissions.permissionId, {
        teamId: team,
      }),
    )
  }

  async detachTeamLinks(teamId: Id): Promise<void> {
    const team = teamKey(teamId)
    if (team === GLOBAL_TEAM) return
    const tables: [SubjectTable, AnyColumn][] = [
      [this.t.modelHasRoles, this.t.modelHasRoles.roleId],
      [this.t.modelHasPermissions, this.t.modelHasPermissions.permissionId],
    ]
    // `team_id = 'acme'` alone would also delete the rows of a lookalike team (`ACME`, `acme `) under a
    // collation that ignores case or trailing spaces. So the rows are read back exactly, and deleted per
    // subject, restricted to the target ids that subject holds in the team: exact, because the primary key
    // stops a lookalike team from holding the same subject and target (same reasoning as `detach`).
    await this.atomically(async (db) => {
      for (const [table, target] of tables) {
        const bySubject = new Map<string, { subject: Subject; ids: number[] }>()
        for (const row of await this.exactRows(db, table, target, { teamId: team })) {
          const k = JSON.stringify([row.subjectType, row.subjectId])
          const entry = bySubject.get(k) ?? { subject: { type: row.subjectType, id: row.subjectId }, ids: [] }
          entry.ids.push(Number(row.id))
          bySubject.set(k, entry)
        }
        for (const { subject, ids } of bySubject.values()) {
          await db
            .delete(table)
            .where(and(...DrizzleRbacAdapter.subjectWhere(table, subject, teamId), inArray(target, ids)))
        }
      }
    })
  }

  /** Link rows matching `where` (subject and/or team), compared exactly (see `sameLink`). */
  private async exactRows(
    db: UntypedDb,
    table: SubjectTable,
    target: AnyColumn,
    where: { subjectType?: string; subjectId?: string; teamId?: string },
  ): Promise<LinkRow[]> {
    const filters: SQL[] = []
    if (where.subjectType !== undefined) filters.push(eq(table.subjectType, where.subjectType))
    if (where.subjectId !== undefined) filters.push(eq(table.subjectId, where.subjectId))
    if (where.teamId !== undefined) filters.push(eq(table.teamId, where.teamId))
    const rows: LinkRow[] = await db.select(this.linkColumns(table, target)).from(table).where(and(...filters))
    return rows.filter(
      (row) =>
        (where.subjectType === undefined || row.subjectType === where.subjectType) &&
        (where.subjectId === undefined || row.subjectId === where.subjectId) &&
        (where.teamId === undefined || row.teamId === where.teamId),
    )
  }

  private static toSubjectLinks(roles: readonly LinkRow[], permissions: readonly LinkRow[]): SubjectLinks {
    return { roles: roles.map(toRoleLink), permissions: permissions.map(toPermissionLink) }
  }

  /** The columns of a link row; `expiresAt` only with `{ expiry: true }` (1.1 tables don't have it). */
  private linkColumns(table: SubjectTable, target: AnyColumn): Record<string, AnyColumn> {
    const columns = { id: target, subjectType: table.subjectType, subjectId: table.subjectId, teamId: table.teamId }
    return this.supportsExpiry ? { ...columns, expiresAt: table.expiresAt! } : columns
  }

  // -------------------------------------------------------------------- helpers

  private static first<T>(rows: readonly T[]): T {
    const row = rows[0]
    if (row === undefined) throw new Error('rbac-evolution-drizzle: INSERT ... RETURNING returned no row')
    return row
  }

  /** MySQL has no `INSERT ... RETURNING`: insert, then read the generated auto-increment id. */
  private async insertReturningId(table: Table, values: Record<string, unknown>): Promise<number> {
    const rows: { id: number }[] = await this.db.insert(table).values(values).$returningId()
    return Number(DrizzleRbacAdapter.first(rows).id)
  }

  /**
   * Idempotent multi-row insert into a link table (every column is part of the primary key).
   * PostgreSQL / SQLite: `ON CONFLICT DO NOTHING`. MySQL: `ON DUPLICATE KEY UPDATE col = col`, a no-op
   * update that — unlike `INSERT IGNORE` — still reports foreign-key and other errors.
   */
  private async insertIgnoringDuplicates(
    table: Table,
    rows: Record<string, unknown>[],
    keyProperty: string,
    keyColumn: AnyColumn,
  ): Promise<void> {
    const insert = this.db.insert(table).values(rows)
    if (this.dialect === 'mysql') {
      await insert.onDuplicateKeyUpdate({ set: { [keyProperty]: sql`${sql.identifier(keyColumn.name)}` } })
    } else {
      await insert.onConflictDoNothing()
    }
  }

  private static subjectWhere(table: SubjectTable, subject: Subject, teamId: TeamId): SQL[] {
    return [
      eq(table.subjectType, subject.type),
      eq(table.subjectId, String(subject.id)),
      eq(table.teamId, teamKey(teamId)),
    ]
  }

  /** The subject's link rows, compared exactly (see `sameLink`). */
  private async linkRows(
    table: SubjectTable,
    target: AnyColumn,
    subject: Subject,
    teamId: TeamId,
  ): Promise<LinkRow[]> {
    const rows: LinkRow[] = await this.db
      .select(this.linkColumns(table, target))
      .from(table)
      .where(and(...DrizzleRbacAdapter.subjectWhere(table, subject, teamId)))
    return rows.filter((row) => sameLink(row, subject.type, String(subject.id), teamKey(teamId)))
  }

  private async getLinks(table: SubjectTable, target: AnyColumn, subject: Subject, teamId: TeamId): Promise<Id[]> {
    return (await this.linkRows(table, target, subject, teamId)).map((row) => Number(row.id))
  }

  private async attach(
    table: SubjectTable,
    targetKey: 'roleId' | 'permissionId',
    target: AnyColumn,
    subject: Subject,
    targetIds: readonly Id[],
    teamId: TeamId,
    options?: AttachLinkOptions,
  ): Promise<void> {
    const ids = toIntIds(targetIds)
    if (ids.length === 0) return
    const base = { subjectType: subject.type, subjectId: String(subject.id), teamId: teamKey(teamId) }
    // With expiry, new links are inserted with their expiry (never briefly permanent) ...
    const expiry = this.supportsExpiry ? { expiresAt: options?.expiresAt ?? null } : {}
    await this.insertIgnoringDuplicates(
      table,
      ids.map((id) => ({ ...base, [targetKey]: id, ...expiry })),
      'subjectType',
      table.subjectType,
    )
    if (expiry.expiresAt === undefined) return
    // ... and links the subject already held get it too (the latest call wins). Only the target ids read back
    // for this exact subject are updated, so a lookalike subject is never touched (same reasoning as `detach`).
    const wanted = new Set(ids)
    const held = (await this.linkRows(table, target, subject, teamId)).map((row) => Number(row.id)).filter((id) => wanted.has(id))
    if (held.length === 0) return
    await this.db
      .update(table)
      .set({ expiresAt: expiry.expiresAt })
      .where(and(...DrizzleRbacAdapter.subjectWhere(table, subject, teamId), inArray(target, held)))
  }

  private async detach(
    table: SubjectTable,
    target: AnyColumn,
    subject: Subject,
    targetIds: readonly Id[] | undefined,
    teamId: TeamId,
  ): Promise<void> {
    const wanted = targetIds === undefined ? undefined : new Set(toIntIds(targetIds))
    if (wanted !== undefined && wanted.size === 0) return
    // Only delete the links this exact subject holds: with a collation that ignores case or trailing spaces,
    // `subject_id = 'admin '` also matches the rows of `admin`. Restricting the delete to the target ids read
    // back is exact, because the primary key stops a lookalike from holding the same target.
    const ids = (await this.linkRows(table, target, subject, teamId))
      .map((row) => Number(row.id))
      .filter((id) => wanted === undefined || wanted.has(id))
    if (ids.length === 0) return
    await this.db
      .delete(table)
      .where(and(...DrizzleRbacAdapter.subjectWhere(table, subject, teamId), inArray(target, ids)))
  }

  private async reverse(
    table: SubjectTable,
    target: AnyColumn,
    subjectType: string,
    targetIds: readonly Id[],
    teamId: TeamId,
    options?: ActiveLinkOptions,
  ): Promise<Id[]> {
    const ids = toIntIds(targetIds)
    if (ids.length === 0) return []
    const team = teamKey(teamId)
    const where = [eq(table.subjectType, subjectType), eq(table.teamId, team), inArray(target, ids)]
    if (this.supportsExpiry && options) where.push(or(isNull(table.expiresAt!), gt(table.expiresAt!, options.now))!)
    const rows: Omit<LinkRow, 'id'>[] = await this.db
      .selectDistinct({ subjectType: table.subjectType, subjectId: table.subjectId, teamId: table.teamId })
      .from(table)
      .where(and(...where))
    const exact = rows.filter((row) => sameLink(row, subjectType, undefined, team))
    return [...new Set(exact.map((row) => row.subjectId))]
  }
}
