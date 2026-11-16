import mysqlExpirySql from '../sql/mysql-expiry.sql?raw'
import mysqlSql from '../sql/mysql.sql?raw'
import pgExpirySql from '../sql/pg-expiry.sql?raw'
import pgSql from '../sql/pg.sql?raw'
import sqliteExpirySql from '../sql/sqlite-expiry.sql?raw'
import sqliteSql from '../sql/sqlite.sql?raw'

export type Dialect = 'pg' | 'sqlite' | 'mysql'

const NAMES = '(?:permissions|roles|role_has_permissions|model_has_roles|model_has_permissions)'

/** Opening quote (`"` or `` ` ``) of a table, constraint or index name. */
const TABLES = new RegExp(`(["\`])(?=${NAMES}\\b|${NAMES}_)`, 'g')

const SOURCES: Record<Dialect, string> = { pg: pgSql, sqlite: sqliteSql, mysql: mysqlSql }
const EXPIRY: Record<Dialect, string> = { pg: pgExpirySql, sqlite: sqliteExpirySql, mysql: mysqlExpirySql }

const prefixed = (text: string, prefix: string): string => (prefix === '' ? text : text.replace(TABLES, `$1${prefix}`))

/**
 * The shipped DDL (`sql/<dialect>.sql`, loaded by Vite as raw text), optionally with a table prefix.
 * With `expiry`, followed by the 1.2 upgrade (`sql/<dialect>-expiry.sql`), as an upgraded database has it.
 */
export function ddl(dialect: Dialect, prefix = '', options: { expiry?: boolean } = {}): string {
  return prefixed(options.expiry === true ? `${SOURCES[dialect]}\n${EXPIRY[dialect]}` : SOURCES[dialect], prefix)
}

/** Only the 1.2 upgrade script (`sql/<dialect>-expiry.sql`), optionally with a table prefix. */
export function expiryDdl(dialect: Dialect, prefix = ''): string {
  return prefixed(EXPIRY[dialect], prefix)
}
