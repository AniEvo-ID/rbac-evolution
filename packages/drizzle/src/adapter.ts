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
import { type AnyColumn, type SQL, type Table, and, eq, inArray, sql } from 'drizzle-orm'

/** Structural shape shared by the PostgreSQL, SQLite and MySQL schemas. */
export interface RbacTables {
  permissions: Table & { id: AnyColumn; name: AnyColumn; guardName: AnyColumn }
  roles: Table & { id: AnyColumn; name: AnyColumn; guardName: AnyColumn; teamId: AnyColumn }
  roleHasPermissions: Table & { roleId: AnyColumn; permissionId: AnyColumn }
  modelHasRoles: Table & { roleId: AnyColumn; subjectType: AnyColumn; subjectId: AnyColumn; teamId: AnyColumn }
  modelHasPermissions: Table & {
    permissionId: AnyColumn
    subjectType: AnyColumn
    subjectId: AnyColumn
    teamId: AnyColumn
  }
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

/**
 * Dialect-agnostic Drizzle implementation of `RbacAdapter`.
 * Use `drizzlePgAdapter()`, `drizzleSqliteAdapter()` or `drizzleMysqlAdapter()` to construct it.
 */
export class DrizzleRbacAdapter implements RbacAdapter {
  constructor(
    private readonly db: UntypedDb,
    private readonly t: RbacTables,
    private readonly dialect: DrizzleDialect = 'pg',
  ) {}

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
    return rows.map(toPermission)
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
    if (query.teamIds !== undefined) {
      if (query.teamIds.length === 0) return []
      where.push(inArray(r.teamId, [...new Set(query.teamIds.map(teamKey))]))
    }

    const rows: RoleRow[] = await this.db
      .select({ id: r.id, name: r.name, guardName: r.guardName, teamId: r.teamId })
      .from(r)
      .where(and(...where))
      .orderBy(r.id)
    return rows.map(toRole)
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

  attachSubjectRoles(subject: Subject, roleIds: readonly Id[], teamId: TeamId): Promise<void> {
    return this.attach(this.t.modelHasRoles, 'roleId', subject, roleIds, teamId)
  }

  detachSubjectRoles(subject: Subject, roleIds: readonly Id[] | undefined, teamId: TeamId): Promise<void> {
    return this.detach(this.t.modelHasRoles, this.t.modelHasRoles.roleId, subject, roleIds, teamId)
  }

  getSubjectPermissionIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    return this.getLinks(this.t.modelHasPermissions, this.t.modelHasPermissions.permissionId, subject, teamId)
  }

  attachSubjectPermissions(subject: Subject, permissionIds: readonly Id[], teamId: TeamId): Promise<void> {
    return this.attach(this.t.modelHasPermissions, 'permissionId', subject, permissionIds, teamId)
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

  getSubjectIdsWithRoles(subjectType: string, roleIds: readonly Id[], teamId: TeamId): Promise<Id[]> {
    return this.reverse(this.t.modelHasRoles, this.t.modelHasRoles.roleId, subjectType, roleIds, teamId)
  }

  getSubjectIdsWithPermissions(subjectType: string, permissionIds: readonly Id[], teamId: TeamId): Promise<Id[]> {
    return this.reverse(
      this.t.modelHasPermissions,
      this.t.modelHasPermissions.permissionId,
      subjectType,
      permissionIds,
      teamId,
    )
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

  private async getLinks(table: SubjectTable, target: AnyColumn, subject: Subject, teamId: TeamId): Promise<Id[]> {
    const rows: { id: number }[] = await this.db
      .select({ id: target })
      .from(table)
      .where(and(...DrizzleRbacAdapter.subjectWhere(table, subject, teamId)))
    return rows.map((row) => Number(row.id))
  }

  private async attach(
    table: SubjectTable,
    targetKey: 'roleId' | 'permissionId',
    subject: Subject,
    targetIds: readonly Id[],
    teamId: TeamId,
  ): Promise<void> {
    const ids = toIntIds(targetIds)
    if (ids.length === 0) return
    const base = { subjectType: subject.type, subjectId: String(subject.id), teamId: teamKey(teamId) }
    await this.insertIgnoringDuplicates(
      table,
      ids.map((id) => ({ ...base, [targetKey]: id })),
      'subjectType',
      table.subjectType,
    )
  }

  private async detach(
    table: SubjectTable,
    target: AnyColumn,
    subject: Subject,
    targetIds: readonly Id[] | undefined,
    teamId: TeamId,
  ): Promise<void> {
    const where = DrizzleRbacAdapter.subjectWhere(table, subject, teamId)
    if (targetIds !== undefined) {
      const ids = toIntIds(targetIds)
      if (ids.length === 0) return
      where.push(inArray(target, ids))
    }
    await this.db.delete(table).where(and(...where))
  }

  private async reverse(
    table: SubjectTable,
    target: AnyColumn,
    subjectType: string,
    targetIds: readonly Id[],
    teamId: TeamId,
  ): Promise<Id[]> {
    const ids = toIntIds(targetIds)
    if (ids.length === 0) return []
    const rows: { id: string }[] = await this.db
      .selectDistinct({ id: table.subjectId })
      .from(table)
      .where(and(eq(table.subjectType, subjectType), eq(table.teamId, teamKey(teamId)), inArray(target, ids)))
    return rows.map((row) => row.id)
  }
}
