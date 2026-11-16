/**
 * @anievo-id/rbac-evolution-drizzle/pg — PostgreSQL schema + adapter.
 */
import type { RbacAdapter } from '@anievo-id/rbac-evolution'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { type DrizzleAdapterOptions, DrizzleRbacAdapter } from './adapter'
import { type PgRbacExpirySchema, type PgRbacSchema, pgRbacSchema } from './pg-schema'

export { pgRbacSchema } from './pg-schema'
export type { PgRbacExpirySchema, PgRbacSchema } from './pg-schema'
export type { DrizzleAdapterOptions } from './adapter'
export type { RbacSchemaOptions } from './names'

/**
 * Creates an `RbacAdapter` backed by a Drizzle PostgreSQL database
 * (node-postgres, postgres.js, Neon, Vercel Postgres, PGlite, ...).
 *
 * @param db     any Drizzle PostgreSQL database instance
 * @param schema the tables from `pgRbacSchema()` (defaults to the unprefixed tables)
 * @param options `{ expiry: true }` to store an expiry per link (needs `pgRbacSchema({ expiry: true })`)
 */
export function drizzlePgAdapter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PgDatabase<PgQueryResultHKT, any, any>,
  schema: PgRbacSchema | PgRbacExpirySchema = pgRbacSchema(),
  options: DrizzleAdapterOptions = {},
): RbacAdapter {
  return new DrizzleRbacAdapter(db, schema, 'pg', options)
}
