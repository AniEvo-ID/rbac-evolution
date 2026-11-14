/**
 * @anievo-id/rbac-evolution-drizzle/mysql — MySQL schema + adapter.
 */
import type { RbacAdapter } from '@anievo-id/rbac-evolution'
import type { MySqlDatabase } from 'drizzle-orm/mysql-core'
import { DrizzleRbacAdapter } from './adapter'
import { type MysqlRbacSchema, mysqlRbacSchema } from './mysql-schema'

export { mysqlRbacSchema } from './mysql-schema'
export type { MysqlRbacSchema } from './mysql-schema'
export type { RbacSchemaOptions } from './names'

/**
 * Creates an `RbacAdapter` backed by a Drizzle MySQL database
 * (mysql2, PlanetScale, TiDB Serverless, ...).
 *
 * @param db     any Drizzle MySQL database instance
 * @param schema the tables from `mysqlRbacSchema()` (defaults to the unprefixed tables)
 */
export function drizzleMysqlAdapter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: MySqlDatabase<any, any, any, any>,
  schema: MysqlRbacSchema = mysqlRbacSchema(),
): RbacAdapter {
  return new DrizzleRbacAdapter(db, schema, 'mysql')
}
