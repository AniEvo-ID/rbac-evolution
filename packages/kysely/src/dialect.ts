import { type Kysely, MssqlAdapter, MysqlAdapter, PostgresAdapter, SqliteAdapter } from 'kysely'

/** SQL dialect family. Third-party Kysely dialects map onto one of these (libsql/D1 → `sqlite`, PGlite/Neon → `postgres`, PlanetScale → `mysql`, ...). */
export type RbacDialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql'

const BY_NAME: Record<string, RbacDialect> = {
  PostgresAdapter: 'postgres',
  MysqlAdapter: 'mysql',
  SqliteAdapter: 'sqlite',
  MssqlAdapter: 'mssql',
}

/**
 * Detects the dialect family from the Kysely instance's dialect adapter.
 * Works for the built-in dialects and for third-party dialects that reuse Kysely's adapters
 * (which nearly all do). Throws when it can't tell — pass `{ dialect }` explicitly then.
 */
export function detectDialect(db: Kysely<any>): RbacDialect {
  let adapter: unknown
  try {
    adapter = db.getExecutor().adapter
  } catch {
    adapter = undefined
  }
  if (adapter instanceof PostgresAdapter) return 'postgres'
  if (adapter instanceof MysqlAdapter) return 'mysql'
  if (adapter instanceof SqliteAdapter) return 'sqlite'
  if (adapter instanceof MssqlAdapter) return 'mssql'

  // Different copy of kysely (e.g. ESM/CJS dual package): walk the prototype chain by class name.
  let proto: unknown = adapter === undefined || adapter === null ? null : Object.getPrototypeOf(adapter)
  while (proto !== null && proto !== Object.prototype) {
    const name = (proto as { constructor?: { name?: unknown } }).constructor?.name
    const dialect = typeof name === 'string' ? BY_NAME[name] : undefined
    if (dialect !== undefined) return dialect
    proto = Object.getPrototypeOf(proto)
  }
  throw new Error(
    "rbac-evolution-kysely: could not detect the database dialect; pass it explicitly, e.g. { dialect: 'postgres' }",
  )
}
