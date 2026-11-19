import {
  type KyselyAdapterOptions,
  type KyselyRbacAdapter,
  type RbacMigrationOptions,
  type RbacTableOptions,
  addRbacExpiryColumns,
  createRbacTables,
  dropRbacExpiryColumns,
  dropRbacTables,
  kyselyAdapter,
} from '@anievo-id/rbac-evolution-kysely'
import { Kysely } from 'kysely'
import { type TypeormDataSource, type TypeormQueryRunner, type TypeormSource, dialectOf, typeormDialect } from './dialect'

export {
  dialectOf,
  typeormDialect,
  type TypeormDataSource,
  type TypeormEntityManager,
  type TypeormQueryRunner,
  type TypeormSource,
} from './dialect'
export type { RbacTableNames, RbacTableOptions } from '@anievo-id/rbac-evolution-kysely'

export interface TypeormAdapterOptions extends RbacTableOptions {
  /**
   * Store an expiry per role assignment and direct permission (`assignRole(role, { expiresAt })`). Needs the
   * `expires_at` column (`rbacMigration({ expiry: true })`, or `rbacExpiryMigration()` for existing tables).
   * Default: `false`.
   */
  expiry?: boolean | undefined
}

/** The adapter type: the Kysely adapter, running its queries through TypeORM. */
export type TypeormRbacAdapter = KyselyRbacAdapter

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kyselyOf = (source: TypeormSource): Kysely<any> => new Kysely({ dialect: typeormDialect(source) })

/**
 * Creates a TypeORM-backed `RbacAdapter` for PostgreSQL, MySQL / MariaDB, SQLite and SQL Server.
 *
 * ```ts
 * const rbac = createRbac({ adapter: typeormAdapter(dataSource) })
 * // inside a transaction: the adapter runs on the transaction's query runner
 * await dataSource.transaction((manager) => createRbac({ adapter: typeormAdapter(manager) }).for(user).assignRole('writer'))
 * ```
 */
export function typeormAdapter(source: TypeormSource, options: TypeormAdapterOptions = {}): TypeormRbacAdapter {
  const adapterOptions: KyselyAdapterOptions = { dialect: dialectOf(source), prefix: options.prefix, expiry: options.expiry }
  return kyselyAdapter(kyselyOf(source), adapterOptions)
}

/** What a TypeORM migration class gets in `up` / `down`: the query runner, with its DataSource. */
interface MigrationQueryRunner extends TypeormQueryRunner {
  readonly dataSource?: TypeormDataSource | undefined
  readonly connection?: TypeormDataSource | undefined
}

/** A TypeORM migration, structurally (`MigrationInterface`). */
export interface RbacTypeormMigration {
  readonly name: string
  up(queryRunner: MigrationQueryRunner): Promise<void>
  down(queryRunner: MigrationQueryRunner): Promise<void>
}

export interface RbacTypeormMigrationOptions extends RbacTableOptions {
  /**
   * The migration's name, ending with a 13-digit timestamp as TypeORM requires. TypeORM runs a migration whose name
   * is not in its migrations table yet, so keep the name once it has run. Default: `RbacEvolutionTables1763510400000`
   * (or `RbacEvolutionExpiry1763510400001` for `rbacExpiryMigration`).
   */
  name?: string | undefined
}

// The migration's own query runner, so the tables are created in TypeORM's migration transaction.
const runnerSource = (runner: MigrationQueryRunner): TypeormSource => ({
  queryRunner: runner,
  dataSource: runner.dataSource,
  connection: runner.connection,
})

const migrationClass = (
  defaultName: string,
  up: (runner: MigrationQueryRunner) => Promise<void>,
  down: (runner: MigrationQueryRunner) => Promise<void>,
  name: string | undefined,
): new () => RbacTypeormMigration =>
  class {
    readonly name = name ?? defaultName
    up = up
    down = down
  }

/**
 * A TypeORM migration class that creates the five rbac tables (and their indexes), like `createRbacTables` of the
 * Kysely package. Add it to the DataSource's `migrations` and run `typeorm migration:run`.
 *
 * ```ts
 * new DataSource({ ..., migrations: [rbacMigration(), ...yourMigrations] })
 * ```
 */
export function rbacMigration(
  options: RbacTypeormMigrationOptions & Pick<RbacMigrationOptions, 'expiry'> = {},
): new () => RbacTypeormMigration {
  const { name, ...tableOptions } = options
  return migrationClass(
    'RbacEvolutionTables1763510400000',
    (runner) => createRbacTables(kyselyOf(runnerSource(runner)), { ...tableOptions, dialect: dialectOf(runnerSource(runner)) }),
    (runner) => dropRbacTables(kyselyOf(runnerSource(runner)), tableOptions),
    name,
  )
}

/** A TypeORM migration class that adds the `expires_at` columns to existing tables, for `{ expiry: true }`. */
export function rbacExpiryMigration(options: RbacTypeormMigrationOptions = {}): new () => RbacTypeormMigration {
  const { name, ...tableOptions } = options
  return migrationClass(
    'RbacEvolutionExpiry1763510400001',
    (runner) =>
      addRbacExpiryColumns(kyselyOf(runnerSource(runner)), { ...tableOptions, dialect: dialectOf(runnerSource(runner)) }),
    (runner) => dropRbacExpiryColumns(kyselyOf(runnerSource(runner)), tableOptions),
    name,
  )
}
