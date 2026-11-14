import { Kysely, MysqlDialect } from 'kysely'
import { createPool } from 'mysql2'
import { describe } from 'vitest'
import { runSharedDatabaseSuite } from './shared'

const url = process.env.MYSQL_URL

// Real MySQL / MariaDB server, e.g. MYSQL_URL=mysql://root:root@localhost:3306/rbac
describe.skipIf(url === undefined || url === '')('kysely (MySQL via mysql2, MYSQL_URL)', () => {
  runSharedDatabaseSuite(
    'kysely (MySQL via mysql2)',
    'mysql',
    () => new Kysely<any>({ dialect: new MysqlDialect({ pool: createPool({ uri: url ?? '', connectionLimit: 4 }) }) }),
    'kysely_test_',
  )
})
