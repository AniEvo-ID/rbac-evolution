import pgSql from '../sql/pg.sql?raw'
import sqliteSql from '../sql/sqlite.sql?raw'

const TABLES =
  /"(?=(?:permissions|roles|role_has_permissions|model_has_roles|model_has_permissions)\b|(?:permissions|roles|role_has_permissions|model_has_roles|model_has_permissions)_)/g

/** The shipped DDL (`sql/<dialect>.sql`, loaded by Vite as raw text), optionally with a table prefix. */
export function ddl(dialect: 'pg' | 'sqlite', prefix = ''): string {
  const text = dialect === 'pg' ? pgSql : sqliteSql
  return prefix === '' ? text : text.replace(TABLES, `"${prefix}`)
}
