import mysqlSql from '../sql/mysql.sql?raw'
import pgSql from '../sql/pg.sql?raw'
import sqliteSql from '../sql/sqlite.sql?raw'

export type Dialect = 'pg' | 'sqlite' | 'mysql'

const NAMES = '(?:permissions|roles|role_has_permissions|model_has_roles|model_has_permissions)'

/** Opening quote (`"` or `` ` ``) of a table, constraint or index name. */
const TABLES = new RegExp(`(["\`])(?=${NAMES}\\b|${NAMES}_)`, 'g')

const SOURCES: Record<Dialect, string> = { pg: pgSql, sqlite: sqliteSql, mysql: mysqlSql }

/** The shipped DDL (`sql/<dialect>.sql`, loaded by Vite as raw text), optionally with a table prefix. */
export function ddl(dialect: Dialect, prefix = ''): string {
  const text = SOURCES[dialect]
  return prefix === '' ? text : text.replace(TABLES, `$1${prefix}`)
}
