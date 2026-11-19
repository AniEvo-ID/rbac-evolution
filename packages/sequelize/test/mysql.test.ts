import { Sequelize } from 'sequelize'
import { describe } from 'vitest'
import { runSequelizeSuite } from './shared'

const url = process.env.MYSQL_URL

// Real MySQL server (MYSQL_URL)
describe.skipIf(url === undefined || url === '')('sequelize (MySQL via mysql2, MYSQL_URL)', () => {
  runSequelizeSuite(
    'sequelize (MySQL via mysql2)',
    'mysql',
    () => new Sequelize(url!, { logging: false }),
    'seq_test_',
  )
})
