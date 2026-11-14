/**
 * @anievo-id/rbac-evolution-drizzle/sqlite — SQLite schema + adapter.
 */
import type { RbacAdapter } from '@anievo-id/rbac-evolution'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { DrizzleRbacAdapter } from './adapter'
import { type SqliteRbacSchema, sqliteRbacSchema } from './sqlite-schema'

export { sqliteRbacSchema } from './sqlite-schema'
export type { SqliteRbacSchema } from './sqlite-schema'
export type { RbacSchemaOptions } from './names'

/**
 * Creates an `RbacAdapter` backed by a Drizzle SQLite database
 * (libsql / Turso, better-sqlite3, Bun SQLite, Cloudflare D1, ...).
 *
 * @param db     any Drizzle SQLite database instance
 * @param schema the tables from `sqliteRbacSchema()` (defaults to the unprefixed tables)
 */
export function drizzleSqliteAdapter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: BaseSQLiteDatabase<'sync' | 'async', any, any, any>,
  schema: SqliteRbacSchema = sqliteRbacSchema(),
): RbacAdapter {
  return new DrizzleRbacAdapter(db, schema, 'sqlite')
}
