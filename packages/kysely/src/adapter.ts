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
import type { Kysely } from 'kysely'
import { type RbacDialect, detectDialect } from './dialect'
import { type RbacTableNames, type RbacTableOptions, tableNames } from './tables'

export interface KyselyAdapterOptions extends RbacTableOptions {
  /** Dialect family. Detected from the Kysely instance when omitted. */
  dialect?: RbacDialect
}

/**
 * The adapter only touches the rbac tables and maps every row explicitly, so it works on any
 * `Kysely<DB>` (your own `Database` type does not need to include the rbac tables).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = Kysely<any>

interface PermissionRow {
  id: number | string | bigint
  name: string
  guard_name: string
}

interface RoleRow extends PermissionRow {
  team_id: string
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
  guardName: row.guard_name,
})

const toRole = (row: RoleRow): Role => ({
  id: Number(row.id),
  name: row.name,
  guardName: row.guard_name,
  teamId: teamFromKey(row.team_id),
})

/** SQL Server duplicate-key error numbers (unique index / primary key). */
const MSSQL_DUPLICATE = new Set([2601, 2627])
const isMssqlDuplicate = (error: unknown): boolean => {
  const number = (error as { number?: unknown } | null)?.number
  return typeof number === 'number' && MSSQL_DUPLICATE.has(number)
}

type SubjectTable = 'modelHasRoles' | 'modelHasPermissions'
const TARGET: Record<SubjectTable, 'role_id' | 'permission_id'> = {
  modelHasRoles: 'role_id',
  modelHasPermissions: 'permission_id',
}

interface SubjectRow {
  subject_type: string
  subject_id: string
  team_id: string
}

/**
 * SQL compares text with the column's collation, which can ignore case or accents, or trailing spaces
 * (MySQL's `utf8mb4_bin` is PAD SPACE, and SQL Server always ignores them). Every row read back is
 * therefore checked again here, with exact string equality, so a subject `admin ` or `ADMIN` never gets
 * the links of `admin`, whatever the schema's collation.
 */
const sameSubject = (row: SubjectRow, subjectType: string, subjectId: string | undefined, team: string): boolean =>
  String(row.subject_type) === subjectType &&
  (subjectId === undefined || String(row.subject_id) === subjectId) &&
  String(row.team_id) === team

/**
 * Kysely implementation of `RbacAdapter` for PostgreSQL, MySQL / MariaDB, SQLite and SQL Server.
 * Construct it with `kyselyAdapter(db, options?)`.
 */
export class KyselyRbacAdapter implements RbacAdapter {
  readonly dialect: RbacDialect
  readonly tables: RbacTableNames

  constructor(
    private readonly db: AnyDb,
    options: KyselyAdapterOptions = {},
  ) {
    this.dialect = options.dialect ?? detectDialect(db)
    this.tables = tableNames(options)
  }

  /**
   * Runs `fn` in a transaction, or in the caller's transaction when the adapter was given one.
   * SQLite runs without one: some drivers open a separate connection per transaction, and with an
   * in-memory database (libsql `:memory:`) that connection sees an empty database.
   */
  private atomically(fn: (db: AnyDb) => Promise<void>): Promise<void> {
    if (this.db.isTransaction || this.dialect === 'sqlite') return fn(this.db)
    return this.db.transaction().execute(fn)
  }

  // ---------------------------------------------------------------- permissions

  async createPermission(data: { name: string; guardName: string }): Promise<Permission> {
    const id = await this.insertReturningId(this.tables.permissions, { name: data.name, guard_name: data.guardName })
    return { id, name: data.name, guardName: data.guardName }
  }

  async findPermissions(query: FindPermissionsQuery = {}): Promise<Permission[]> {
    let q = this.db.selectFrom(this.tables.permissions).select(['id', 'name', 'guard_name'])
    if (query.ids !== undefined) {
      const ids = toIntIds(query.ids)
      if (ids.length === 0) return []
      q = q.where('id', 'in', ids)
    }
    if (query.names !== undefined) {
      if (query.names.length === 0) return []
      q = q.where('name', 'in', [...query.names])
    }
    if (query.guardName !== undefined) q = q.where('guard_name', '=', query.guardName)
    const rows: PermissionRow[] = await q.orderBy('id').execute()
    // Exact match, whatever the collation (see `sameSubject`).
    const names = query.names === undefined ? undefined : new Set(query.names)
    return rows
      .filter(
        (row) =>
          (names === undefined || names.has(row.name)) &&
          (query.guardName === undefined || row.guard_name === query.guardName),
      )
      .map(toPermission)
  }

  async deletePermission(id: Id): Promise<void> {
    const pid = toIntId(id)
    if (pid === null) return
    const { permissions, roleHasPermissions, modelHasPermissions } = this.tables
    // Links are removed explicitly: FK cascades may be disabled (e.g. SQLite without `PRAGMA foreign_keys`).
    // One transaction, so a failure can't leave roles without a permission that still exists.
    await this.atomically(async (db) => {
      await db.deleteFrom(roleHasPermissions).where('permission_id', '=', pid).execute()
      await db.deleteFrom(modelHasPermissions).where('permission_id', '=', pid).execute()
      await db.deleteFrom(permissions).where('id', '=', pid).execute()
    })
  }

  // ---------------------------------------------------------------------- roles

  async createRole(data: { name: string; guardName: string; teamId: TeamId }): Promise<Role> {
    const team = teamKey(data.teamId)
    const id = await this.insertReturningId(this.tables.roles, {
      name: data.name,
      guard_name: data.guardName,
      team_id: team,
    })
    return { id, name: data.name, guardName: data.guardName, teamId: teamFromKey(team) }
  }

  async findRoles(query: FindRolesQuery = {}): Promise<Role[]> {
    let q = this.db.selectFrom(this.tables.roles).select(['id', 'name', 'guard_name', 'team_id'])
    if (query.ids !== undefined) {
      const ids = toIntIds(query.ids)
      if (ids.length === 0) return []
      q = q.where('id', 'in', ids)
    }
    if (query.names !== undefined) {
      if (query.names.length === 0) return []
      q = q.where('name', 'in', [...query.names])
    }
    if (query.guardName !== undefined) q = q.where('guard_name', '=', query.guardName)
    const teams = query.teamIds === undefined ? undefined : new Set(query.teamIds.map(teamKey))
    if (teams !== undefined) {
      if (teams.size === 0) return []
      q = q.where('team_id', 'in', [...teams])
    }
    const rows: RoleRow[] = await q.orderBy('id').execute()
    // Exact match, whatever the collation (see `sameSubject`).
    const names = query.names === undefined ? undefined : new Set(query.names)
    return rows
      .filter(
        (row) =>
          (names === undefined || names.has(row.name)) &&
          (query.guardName === undefined || row.guard_name === query.guardName) &&
          (teams === undefined || teams.has(String(row.team_id))),
      )
      .map(toRole)
  }

  async deleteRole(id: Id): Promise<void> {
    const rid = toIntId(id)
    if (rid === null) return
    const { roles, roleHasPermissions, modelHasRoles } = this.tables
    await this.atomically(async (db) => {
      await db.deleteFrom(roleHasPermissions).where('role_id', '=', rid).execute()
      await db.deleteFrom(modelHasRoles).where('role_id', '=', rid).execute()
      await db.deleteFrom(roles).where('id', '=', rid).execute()
    })
  }

  // ---------------------------------------------------------- role ↔ permission

  async getRolePermissionLinks(roleIds: readonly Id[]): Promise<RolePermissionLink[]> {
    const ids = toIntIds(roleIds)
    if (ids.length === 0) return []
    const rows: { role_id: number; permission_id: number }[] = await this.db
      .selectFrom(this.tables.roleHasPermissions)
      .select(['role_id', 'permission_id'])
      .where('role_id', 'in', ids)
      .execute()
    return rows.map((row) => ({ roleId: Number(row.role_id), permissionId: Number(row.permission_id) }))
  }

  async attachRolePermissions(roleId: Id, permissionIds: readonly Id[]): Promise<void> {
    const rid = toIntId(roleId)
    const ids = toIntIds(permissionIds)
    if (rid === null || ids.length === 0) return
    await this.insertIgnore(
      this.tables.roleHasPermissions,
      ids.map((permissionId) => ({ role_id: rid, permission_id: permissionId })),
    )
  }

  async detachRolePermissions(roleId: Id, permissionIds?: readonly Id[]): Promise<void> {
    const rid = toIntId(roleId)
    if (rid === null) return
    let q = this.db.deleteFrom(this.tables.roleHasPermissions).where('role_id', '=', rid)
    if (permissionIds !== undefined) {
      const ids = toIntIds(permissionIds)
      if (ids.length === 0) return
      q = q.where('permission_id', 'in', ids)
    }
    await q.execute()
  }

  // ------------------------------------------------------------- subject links

  getSubjectRoleIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    return this.getLinks('modelHasRoles', subject, teamId)
  }

  attachSubjectRoles(subject: Subject, roleIds: readonly Id[], teamId: TeamId): Promise<void> {
    return this.attach('modelHasRoles', subject, roleIds, teamId)
  }

  detachSubjectRoles(subject: Subject, roleIds: readonly Id[] | undefined, teamId: TeamId): Promise<void> {
    return this.detach('modelHasRoles', subject, roleIds, teamId)
  }

  getSubjectPermissionIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    return this.getLinks('modelHasPermissions', subject, teamId)
  }

  attachSubjectPermissions(subject: Subject, permissionIds: readonly Id[], teamId: TeamId): Promise<void> {
    return this.attach('modelHasPermissions', subject, permissionIds, teamId)
  }

  detachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[] | undefined,
    teamId: TeamId,
  ): Promise<void> {
    return this.detach('modelHasPermissions', subject, permissionIds, teamId)
  }

  getSubjectIdsWithRoles(subjectType: string, roleIds: readonly Id[], teamId: TeamId): Promise<Id[]> {
    return this.reverse('modelHasRoles', subjectType, roleIds, teamId)
  }

  getSubjectIdsWithPermissions(subjectType: string, permissionIds: readonly Id[], teamId: TeamId): Promise<Id[]> {
    return this.reverse('modelHasPermissions', subjectType, permissionIds, teamId)
  }

  // -------------------------------------------------------------------- helpers

  /** INSERT one row and return its generated integer id (RETURNING, OUTPUT or the driver's insert id). */
  private async insertReturningId(table: string, values: Record<string, string>): Promise<number> {
    const insert = this.db.insertInto(table).values(values)
    let id: unknown
    if (this.dialect === 'postgres' || this.dialect === 'sqlite') {
      id = (await insert.returning('id').executeTakeFirst())?.id
    } else if (this.dialect === 'mssql') {
      id = (await insert.output('inserted.id').executeTakeFirst())?.id
    } else {
      id = (await insert.executeTakeFirst()).insertId
    }
    if (id === undefined || id === null) throw new Error(`rbac-evolution-kysely: INSERT into ${table} returned no id`)
    return Number(id)
  }

  /** Multi-row INSERT that silently skips rows whose primary key already exists. */
  private async insertIgnore(table: string, rows: Record<string, string | number>[]): Promise<void> {
    const first = rows[0]
    if (first === undefined) return
    const columns = Object.keys(first)
    switch (this.dialect) {
      case 'postgres':
      case 'sqlite':
        await this.db
          .insertInto(table)
          .values(rows)
          .onConflict((oc) => oc.doNothing())
          .execute()
        return
      case 'mysql': {
        // No-op update instead of INSERT IGNORE, which would also swallow foreign-key and other errors.
        const column = columns[0] as string
        await this.db
          .insertInto(table)
          .values(rows)
          .onDuplicateKeyUpdate((eb) => ({ [column]: eb.ref(column) }))
          .execute()
        return
      }
      case 'mssql':
        // No ON CONFLICT: insert row by row when absent; a concurrent duplicate is a no-op too.
        for (const row of rows) {
          try {
            await this.db
              .insertInto(table)
              .columns(columns)
              .expression(
                this.db
                  .selectNoFrom((eb) => columns.map((c) => eb.val(row[c]).as(c)))
                  .where((eb) =>
                    eb.not(
                      eb.exists(
                        this.db
                          .selectFrom(table)
                          .select((s) => s.lit(1).as('one'))
                          .where((s) => s.and(columns.map((c) => s(c, '=', row[c])))),
                      ),
                    ),
                  ),
              )
              .execute()
          } catch (error) {
            if (!isMssqlDuplicate(error)) throw error
          }
        }
        return
    }
  }

  private subjectQuery(table: SubjectTable, subject: Subject, teamId: TeamId) {
    return {
      subject_type: subject.type,
      subject_id: String(subject.id),
      team_id: teamKey(teamId),
      name: this.tables[table],
    }
  }

  /** Target ids of the subject's link rows, compared exactly (see `sameSubject`). */
  private async getLinks(table: SubjectTable, subject: Subject, teamId: TeamId): Promise<number[]> {
    const s = this.subjectQuery(table, subject, teamId)
    const target = TARGET[table]
    const rows: (SubjectRow & Record<string, unknown>)[] = await this.db
      .selectFrom(s.name)
      .select([target, 'subject_type', 'subject_id', 'team_id'])
      .where('subject_type', '=', s.subject_type)
      .where('subject_id', '=', s.subject_id)
      .where('team_id', '=', s.team_id)
      .execute()
    return rows
      .filter((row) => sameSubject(row, s.subject_type, s.subject_id, s.team_id))
      .map((row) => Number(row[target]))
  }

  private async attach(table: SubjectTable, subject: Subject, targetIds: readonly Id[], teamId: TeamId): Promise<void> {
    const ids = toIntIds(targetIds)
    if (ids.length === 0) return
    const s = this.subjectQuery(table, subject, teamId)
    const target = TARGET[table]
    await this.insertIgnore(
      s.name,
      ids.map((id) => ({ [target]: id, subject_type: s.subject_type, subject_id: s.subject_id, team_id: s.team_id })),
    )
  }

  private async detach(
    table: SubjectTable,
    subject: Subject,
    targetIds: readonly Id[] | undefined,
    teamId: TeamId,
  ): Promise<void> {
    const wanted = targetIds === undefined ? undefined : new Set(toIntIds(targetIds))
    if (wanted !== undefined && wanted.size === 0) return
    // Only delete the links this exact subject holds: with a collation that ignores case or trailing spaces,
    // `subject_id = 'admin '` also matches the rows of `admin`. Restricting the delete to the target ids read
    // back is exact, because the primary key stops a lookalike from holding the same target.
    const ids = (await this.getLinks(table, subject, teamId)).filter((id) => wanted === undefined || wanted.has(id))
    if (ids.length === 0) return
    const s = this.subjectQuery(table, subject, teamId)
    await this.db
      .deleteFrom(s.name)
      .where('subject_type', '=', s.subject_type)
      .where('subject_id', '=', s.subject_id)
      .where('team_id', '=', s.team_id)
      .where(TARGET[table], 'in', ids)
      .execute()
  }

  private async reverse(
    table: SubjectTable,
    subjectType: string,
    targetIds: readonly Id[],
    teamId: TeamId,
  ): Promise<Id[]> {
    const ids = toIntIds(targetIds)
    if (ids.length === 0) return []
    const team = teamKey(teamId)
    const rows: SubjectRow[] = await this.db
      .selectFrom(this.tables[table])
      .select(['subject_type', 'subject_id', 'team_id'])
      .distinct()
      .where('subject_type', '=', subjectType)
      .where('team_id', '=', team)
      .where(TARGET[table], 'in', ids)
      .execute()
    const exact = rows.filter((row) => sameSubject(row, subjectType, undefined, team))
    return [...new Set(exact.map((row) => String(row.subject_id)))]
  }
}

/**
 * Creates a Kysely-backed `RbacAdapter`.
 *
 * ```ts
 * const rbac = createRbac({ adapter: kyselyAdapter(db) })
 * const rbac = createRbac({ adapter: kyselyAdapter(db, { dialect: 'mysql', prefix: 'rbac_' }) })
 * ```
 */
export function kyselyAdapter(db: Kysely<any>, options: KyselyAdapterOptions = {}): KyselyRbacAdapter {
  return new KyselyRbacAdapter(db, options)
}
