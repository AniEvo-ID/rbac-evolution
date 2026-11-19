import { Sequelize } from 'sequelize'
import { describe } from 'vitest'
import { runSequelizeSuite } from './shared'

const url = process.env.PG_URL

// Real PostgreSQL server (PG_URL)
describe.skipIf(url === undefined || url === '')('sequelize (PostgreSQL via pg, PG_URL)', () => {
  runSequelizeSuite(
    'sequelize (PostgreSQL via pg)',
    'postgres',
    () => new Sequelize(url!, { logging: false }),
    'seq_test_',
  )
})
