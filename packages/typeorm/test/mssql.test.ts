import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { describe } from 'vitest'
import { runDataSourceSuite, suiteOptions } from './shared'

const url = process.env.MSSQL_URL

// Real SQL Server, e.g. MSSQL_URL=mssql://sa:Password1!@localhost:1433/master
describe.skipIf(url === undefined || url === '')('typeorm (SQL Server via mssql, MSSQL_URL)', () => {
  const u = new URL(url ?? 'mssql://localhost')
  runDataSourceSuite(
    'typeorm (SQL Server via mssql)',
    'mssql',
    () =>
      new DataSource({
        type: 'mssql',
        host: u.hostname,
        port: Number(u.port || 1433),
        username: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.slice(1) || 'master',
        options: { trustServerCertificate: true },
        ...suiteOptions('typeorm_test_'),
      }),
    'typeorm_test_',
  )
})
