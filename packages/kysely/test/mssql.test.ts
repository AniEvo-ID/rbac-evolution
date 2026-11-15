import { Kysely, MssqlDialect } from 'kysely'
import * as tarn from 'tarn'
import * as tedious from 'tedious'
import { describe } from 'vitest'
import { runSharedDatabaseSuite } from './shared'

const url = process.env.MSSQL_URL

/** `mssql://user:password@host:port/database` (percent-encode special characters in the password). */
function connect(): Kysely<any> {
  const { hostname, port, username, password, pathname } = new URL(url ?? '')
  return new Kysely<any>({
    dialect: new MssqlDialect({
      tarn: { ...tarn, options: { min: 0, max: 4 } },
      tedious: {
        ...tedious,
        connectionFactory: () =>
          new tedious.Connection({
            server: hostname,
            authentication: {
              type: 'default',
              options: { userName: decodeURIComponent(username), password: decodeURIComponent(password) },
            },
            options: {
              port: Number(port || 1433),
              database: decodeURIComponent(pathname.slice(1)) || 'master',
              // The CI container uses a self-signed certificate.
              trustServerCertificate: true,
            },
          }),
      },
    }),
  })
}

// Real SQL Server, e.g. MSSQL_URL=mssql://sa:Rbac%2Dtest1@localhost:1433/master
describe.skipIf(url === undefined || url === '')('kysely (SQL Server via tedious, MSSQL_URL)', () => {
  runSharedDatabaseSuite('kysely (SQL Server via tedious)', 'mssql', connect, 'kysely_test_')
})
