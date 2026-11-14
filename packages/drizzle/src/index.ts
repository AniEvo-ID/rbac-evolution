/**
 * @anievo-id/rbac-evolution-drizzle
 *
 * Drizzle ORM storage adapter (PostgreSQL & SQLite) for rbac-evolution.
 * Dialect-specific entry points are also available as `/pg` and `/sqlite`.
 */

export { drizzlePgAdapter, pgRbacSchema } from './pg'
export type { PgRbacSchema } from './pg'
export { drizzleSqliteAdapter, sqliteRbacSchema } from './sqlite'
export type { SqliteRbacSchema } from './sqlite'
export { DrizzleRbacAdapter } from './adapter'
export type { RbacTables } from './adapter'
export type { RbacSchemaOptions, RbacTableNames } from './names'
