import { Sequelize } from 'sequelize'
import { describe } from 'vitest'
import { runSequelizeSuite } from './shared'

const url = process.env.MSSQL_URL

// Real SQL Server server (MSSQL_URL)
describe.skipIf(url === undefined || url === '')('sequelize (SQL Server via tedious, MSSQL_URL)', () => {
  runSequelizeSuite(
    'sequelize (SQL Server via tedious)',
    'mssql',
    () => new Sequelize(url!, { logging: false, dialectOptions: { options: { trustServerCertificate: true } } }),
    'seq_test_',
  )
})
