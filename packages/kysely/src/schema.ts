import { type ColumnDefinitionBuilder, type CreateTableBuilder, type Kysely, sql } from 'kysely'
import { type RbacDialect, detectDialect } from './dialect'
import { type RbacTableOptions, tableNames } from './tables'

export interface RbacMigrationOptions extends RbacTableOptions {
  /** Dialect family. Detected from the Kysely instance when omitted. */
  dialect?: RbacDialect | undefined
  /**
   * `createRbacTables` only: also create the nullable `expires_at` column of `model_has_roles` and
   * `model_has_permissions`, needed by `kyselyAdapter(db, { expiry: true })`. Default: `false` (the 1.1 tables).
   * For tables that already exist, use `addRbacExpiryColumns` / `rbacExpiryMigration` instead.
   */
  expiry?: boolean | undefined
}

/**
 * A Kysely migration, as returned by {@link rbacMigration} and {@link rbacExpiryMigration}. It has the same shape
 * as Kysely's own `Migration` type, which is exported by `kysely` on 0.28 and by `kysely/migration` on 0.29, so it
 * can be passed to the `Migrator` of either version. `down` is optional only to match that type: the helpers
 * always set it.
 */
export interface RbacMigration {
  up(db: Kysely<any>): Promise<void>
  down?(db: Kysely<any>): Promise<void>
}

type Col = (c: ColumnDefinitionBuilder) => ColumnDefinitionBuilder

interface Types {
  /** Auto-increment integer primary key. */
  id: { type: Parameters<CreateTableBuilder<string>['addColumn']>[1]; build: Col }
  /** Indexable string column. */
  text: Parameters<CreateTableBuilder<string>['addColumn']>[1]
  timestamp: Parameters<CreateTableBuilder<string>['addColumn']>[1]
  /** `expires_at`: compared with the engine's clock, so stored with milliseconds (SQLite: unix ms). */
  expiresAt: Parameters<CreateTableBuilder<string>['addColumn']>[1]
  now: ReturnType<typeof sql.raw>
}

const types = (dialect: RbacDialect): Types => {
  switch (dialect) {
    case 'postgres':
      return {
        id: { type: 'serial', build: (c) => c.primaryKey() },
        text: 'text',
        timestamp: 'timestamptz',
        expiresAt: 'timestamptz',
        now: sql.raw('now()'),
      }
    case 'sqlite':
      return {
        id: { type: 'integer', build: (c) => c.primaryKey().autoIncrement() },
        text: 'text',
        timestamp: 'integer',
        expiresAt: 'integer',
        now: sql.raw("(cast(strftime('%s', 'now') as integer))"),
      }
    case 'mysql':
      return {
        id: { type: 'integer', build: (c) => c.primaryKey().autoIncrement() },
        // Binary collation: names and subject ids compare case- and accent-sensitively, like the other dialects.
        text: sql.raw('varchar(255) character set utf8mb4 collate utf8mb4_bin'),
        timestamp: 'datetime',
        expiresAt: sql.raw('datetime(3)'),
        now: sql.raw('CURRENT_TIMESTAMP'),
      }
    case 'mssql':
      return {
        id: { type: 'integer', build: (c) => c.primaryKey().identity() },
        // Binary collation, like MySQL: the server default (e.g. SQL_Latin1_General_CP1_CI_AS) ignores case.
        text: sql.raw('nvarchar(255) collate Latin1_General_100_BIN2'),
        timestamp: sql.raw('datetime2'),
        expiresAt: sql.raw('datetime2(3)'),
        now: sql.raw('CURRENT_TIMESTAMP'),
      }
  }
}

/**
 * Creates the five rbac-evolution tables (plus constraints and indexes) for the given dialect.
 * Tables that already exist are skipped, so it is safe to call more than once.
 *
 * ```ts
 * await createRbacTables(db)                                  // dialect detected
 * await createRbacTables(db, { dialect: 'mysql', prefix: 'rbac_' })
 * ```
 */
export async function createRbacTables(db: Kysely<any>, options: RbacMigrationOptions = {}): Promise<void> {
  const dialect = options.dialect ?? detectDialect(db)
  const prefix = options.prefix ?? ''
  const n = tableNames(options)
  const t = types(dialect)
  const existing = new Set((await db.introspection.getTables()).map((table) => table.name))
  const missing = (name: string): boolean => !existing.has(name)
  const notNull: Col = (c) => c.notNull()
  const timestamp: Col = (c) => c.notNull().defaultTo(t.now)
  const teamId: Col = (c) => c.notNull().defaultTo('')
  const cascade = (c: { onDelete: (a: 'cascade') => unknown }) => c.onDelete('cascade') as never

  if (missing(n.permissions)) {
    await db.schema
      .createTable(n.permissions)
      .addColumn('id', t.id.type, t.id.build)
      .addColumn('name', t.text, notNull)
      .addColumn('guard_name', t.text, notNull)
      .addColumn('created_at', t.timestamp, timestamp)
      .addColumn('updated_at', t.timestamp, timestamp)
      .addUniqueConstraint(`${prefix}permissions_name_guard_name_unique`, ['name', 'guard_name'])
      .execute()
  }

  if (missing(n.roles)) {
    await db.schema
      .createTable(n.roles)
      .addColumn('id', t.id.type, t.id.build)
      .addColumn('name', t.text, notNull)
      .addColumn('guard_name', t.text, notNull)
      .addColumn('team_id', t.text, teamId)
      .addColumn('created_at', t.timestamp, timestamp)
      .addColumn('updated_at', t.timestamp, timestamp)
      .addUniqueConstraint(`${prefix}roles_name_guard_name_team_id_unique`, ['name', 'guard_name', 'team_id'])
      .execute()
  }

  if (missing(n.roleHasPermissions)) {
    await db.schema
      .createTable(n.roleHasPermissions)
      .addColumn('role_id', 'integer', notNull)
      .addColumn('permission_id', 'integer', notNull)
      .addPrimaryKeyConstraint(`${prefix}role_has_permissions_pkey`, ['role_id', 'permission_id'])
      .addForeignKeyConstraint(
        `${prefix}role_has_permissions_role_id_fkey`,
        ['role_id'],
        n.roles,
        ['id'],
        cascade,
      )
      .addForeignKeyConstraint(
        `${prefix}role_has_permissions_permission_id_fkey`,
        ['permission_id'],
        n.permissions,
        ['id'],
        cascade,
      )
      .execute()
    await db.schema
      .createIndex(`${prefix}role_has_permissions_permission_id_index`)
      .on(n.roleHasPermissions)
      .column('permission_id')
      .execute()
  }

  for (const [table, target, parent] of [
    [n.modelHasRoles, 'role_id', n.roles],
    [n.modelHasPermissions, 'permission_id', n.permissions],
  ] as const) {
    if (!missing(table)) continue
    const base = table.slice(prefix.length)
    let create = db.schema
      .createTable(table)
      .addColumn(target, 'integer', notNull)
      .addColumn('subject_type', t.text, notNull)
      .addColumn('subject_id', t.text, notNull)
      .addColumn('team_id', t.text, teamId)
    if (options.expiry === true) create = create.addColumn('expires_at', t.expiresAt)
    await create
      .addPrimaryKeyConstraint(`${prefix}${base}_pkey`, ['subject_type', 'subject_id', 'team_id', target])
      .addForeignKeyConstraint(`${prefix}${base}_${target}_fkey`, [target], parent, ['id'], cascade)
      .execute()
    await db.schema.createIndex(`${prefix}${base}_${target}_index`).on(table).column(target).execute()
  }
}

/** The link tables (of the five) that have no `expires_at` column yet. */
async function linkTablesWithout(db: Kysely<any>, options: RbacTableOptions, has: boolean): Promise<string[]> {
  const n = tableNames(options)
  const tables = await db.introspection.getTables()
  return [n.modelHasRoles, n.modelHasPermissions].filter((name) => {
    const table = tables.find((t) => t.name === name)
    return table !== undefined && table.columns.some((c) => c.name === 'expires_at') === has
  })
}

/**
 * Upgrades existing tables for expiry (1.2): adds the nullable `expires_at` column to `model_has_roles` and
 * `model_has_permissions`. Existing rows get `NULL` (permanent). Tables that already have it are skipped.
 * Then create the adapter with `kyselyAdapter(db, { expiry: true })`.
 */
export async function addRbacExpiryColumns(db: Kysely<any>, options: RbacMigrationOptions = {}): Promise<void> {
  const t = types(options.dialect ?? detectDialect(db))
  for (const table of await linkTablesWithout(db, options, false)) {
    await db.schema.alterTable(table).addColumn('expires_at', t.expiresAt).execute()
  }
}

/** Removes the `expires_at` columns again (the `down` of {@link rbacExpiryMigration}). Expiry data is lost. */
export async function dropRbacExpiryColumns(db: Kysely<any>, options: RbacTableOptions = {}): Promise<void> {
  for (const table of await linkTablesWithout(db, options, true)) {
    await db.schema.alterTable(table).dropColumn('expires_at').execute()
  }
}

/**
 * A Kysely migration that adds (`up`) and removes (`down`) the `expires_at` columns. Add it after
 * `rbacMigration()` to upgrade a 1.1 database for `kyselyAdapter(db, { expiry: true })`.
 *
 * ```ts
 * provider: { getMigrations: async () => ({ '0001_rbac': rbacMigration(), '0002_rbac_expiry': rbacExpiryMigration() }) }
 * ```
 */
export function rbacExpiryMigration(options: RbacMigrationOptions = {}): RbacMigration {
  return {
    up: (db) => addRbacExpiryColumns(db, options),
    down: (db) => dropRbacExpiryColumns(db, options),
  }
}

/** Drops the five rbac-evolution tables (if they exist). */
export async function dropRbacTables(db: Kysely<any>, options: RbacTableOptions = {}): Promise<void> {
  const n = tableNames(options)
  for (const table of [n.modelHasPermissions, n.modelHasRoles, n.roleHasPermissions, n.roles, n.permissions]) {
    await db.schema.dropTable(table).ifExists().execute()
  }
}

/**
 * A Kysely migration that creates (`up`) and drops (`down`) the rbac-evolution tables.
 *
 * ```ts
 * const migrator = new Migrator({
 *   db,
 *   provider: { getMigrations: async () => ({ '0001_rbac': rbacMigration(), ...yourMigrations }) },
 * })
 * ```
 */
export function rbacMigration(options: RbacMigrationOptions = {}): RbacMigration {
  return {
    up: (db) => createRbacTables(db, options),
    down: (db) => dropRbacTables(db, options),
  }
}
