import {
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
import { type SequelizeInstance, type SequelizeSource, dialectOf, sequelizeDialect } from './dialect'

export {
  dialectOf,
  sequelizeDialect,
  toBindSql,
  type SequelizeInstance,
  type SequelizeSource,
  type SequelizeTransaction,
} from './dialect'
export type { RbacTableNames, RbacTableOptions } from '@anievo-id/rbac-evolution-kysely'

export interface SequelizeAdapterOptions extends RbacTableOptions {
  /**
   * Store an expiry per role assignment and direct permission (`assignRole(role, { expiresAt })`). Needs the
   * `expires_at` column (`rbacMigration({ expiry: true })`, or `rbacExpiryMigration()` for existing tables).
   * Default: `false`.
   */
  expiry?: boolean | undefined
}

/** The adapter type: the Kysely adapter, running its queries through `sequelize.query()`. */
export type SequelizeRbacAdapter = KyselyRbacAdapter

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kyselyOf = (source: SequelizeSource): Kysely<any> => new Kysely({ dialect: sequelizeDialect(source) })

/**
 * Creates a Sequelize-backed `RbacAdapter` for PostgreSQL, MySQL / MariaDB, SQLite and SQL Server.
 *
 * ```ts
 * const rbac = createRbac({ adapter: sequelizeAdapter(sequelize) })
 * // inside a transaction: the adapter runs in it
 * await sequelize.transaction((t) => createRbac({ adapter: sequelizeAdapter(t) }).for(user).assignRole('writer'))
 * ```
 */
export function sequelizeAdapter(source: SequelizeSource, options: SequelizeAdapterOptions = {}): SequelizeRbacAdapter {
  return kyselyAdapter(kyselyOf(source), { dialect: dialectOf(source), prefix: options.prefix, expiry: options.expiry })
}

/**
 * What a migration gets: sequelize-cli passes the QueryInterface first, Umzug passes `{ context }` (set `context` to
 * the QueryInterface or the Sequelize instance).
 */
type MigrationArgument = { sequelize: SequelizeInstance } | SequelizeInstance | { context: { sequelize: SequelizeInstance } | SequelizeInstance }

const instanceOf = (arg: MigrationArgument): SequelizeInstance => {
  const target = 'context' in arg ? arg.context : arg
  return 'sequelize' in target && typeof (target as { sequelize?: unknown }).sequelize === 'object'
    ? (target as { sequelize: SequelizeInstance }).sequelize
    : (target as SequelizeInstance)
}

/** A migration for sequelize-cli (`up(queryInterface)`) and Umzug (`up({ context })`). */
export interface RbacSequelizeMigration {
  up(arg: MigrationArgument): Promise<void>
  down(arg: MigrationArgument): Promise<void>
}

/**
 * A migration that creates the five rbac tables (and their indexes), like `createRbacTables` of the Kysely package.
 *
 * ```js
 * // migrations/20261119000000-rbac.js (sequelize-cli)
 * module.exports = require('@anievo-id/rbac-evolution-sequelize').rbacMigration()
 * ```
 */
export function rbacMigration(options: RbacTableOptions & Pick<RbacMigrationOptions, 'expiry'> = {}): RbacSequelizeMigration {
  return {
    up: async (arg) => {
      const sequelize = instanceOf(arg)
      await createRbacTables(kyselyOf(sequelize), { ...options, dialect: dialectOf(sequelize) })
    },
    down: (arg) => dropRbacTables(kyselyOf(instanceOf(arg)), options),
  }
}

/** A migration that adds the `expires_at` columns to existing tables, for `{ expiry: true }`. */
export function rbacExpiryMigration(options: RbacTableOptions = {}): RbacSequelizeMigration {
  return {
    up: async (arg) => {
      const sequelize = instanceOf(arg)
      await addRbacExpiryColumns(kyselyOf(sequelize), { ...options, dialect: dialectOf(sequelize) })
    },
    down: (arg) => dropRbacExpiryColumns(kyselyOf(instanceOf(arg)), options),
  }
}
