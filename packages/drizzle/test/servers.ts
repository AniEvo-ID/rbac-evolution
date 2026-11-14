/**
 * Real database servers for the optional integration suites.
 *
 * - `PG_URL`    e.g. `postgresql://user:pass@localhost:5432/postgres`
 * - `MYSQL_URL` e.g. `mysql://root:pass@127.0.0.1:3306/mysql`
 *
 * Each suite works in its own database (created on demand) so it never collides with other
 * packages' suites that share the same server in CI.
 */
export const PG_URL = process.env['PG_URL'] ?? ''
export const MYSQL_URL = process.env['MYSQL_URL'] ?? ''

/** Suite title suffix that makes a skip visible in the test output. */
export const skipNote = (envVar: string, url: string): string => (url === '' ? ` (skipped: ${envVar} not set)` : '')

/** `url` with its database (path) replaced by `database`. */
export function withDatabase(url: string, database: string): string {
  const u = new URL(url)
  u.pathname = `/${database}`
  return u.toString()
}

/** Name of the database the suite works in. */
export const TEST_DATABASE = 'rbac_evolution_drizzle_test'
