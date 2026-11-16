/**
 * @anievo-id/rbac-evolution-drizzle/mysql — MySQL schema + adapter.
 */
import type { RbacAdapter } from '@anievo-id/rbac-evolution'
import type { MySqlDatabase } from 'drizzle-orm/mysql-core'
import { type DrizzleAdapterOptions, DrizzleRbacAdapter } from './adapter'
import { type MysqlRbacExpirySchema, type MysqlRbacSchema, mysqlRbacSchema } from './mysql-schema'

export { mysqlRbacSchema } from './mysql-schema'
export type { MysqlRbacExpirySchema, MysqlRbacSchema } from './mysql-schema'
export type { DrizzleAdapterOptions } from './adapter'
export type { RbacSchemaOptions } from './names'

/**
 * Creates an `RbacAdapter` backed by a Drizzle MySQL database
 * (mysql2, PlanetScale, TiDB Serverless, ...).
 *
 * @param db     any Drizzle MySQL database instance
 * @param schema the tables from `mysqlRbacSchema()` (defaults to the unprefixed tables)
 * @param options `{ expiry: true }` to store an expiry per link (needs `mysqlRbacSchema({ expiry: true })`)
 */
export function drizzleMysqlAdapter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: MySqlDatabase<any, any, any, any>,
  schema: MysqlRbacSchema | MysqlRbacExpirySchema = mysqlRbacSchema(),
  options: DrizzleAdapterOptions = {},
): RbacAdapter {
  return new DrizzleRbacAdapter(db, schema, 'mysql', options)
}
