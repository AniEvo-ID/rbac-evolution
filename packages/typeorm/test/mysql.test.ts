import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { describe } from 'vitest'
import { runDataSourceSuite, suiteOptions } from './shared'

const url = process.env.MYSQL_URL

// Real MySQL server, e.g. MYSQL_URL=mysql://root:root@127.0.0.1:3306/rbac
describe.skipIf(url === undefined || url === '')('typeorm (MySQL via mysql2, MYSQL_URL)', () => {
  runDataSourceSuite(
    'typeorm (MySQL via mysql2)',
    'mysql',
    () => new DataSource({ type: 'mysql', url: url!, ...suiteOptions('typeorm_test_') }),
    'typeorm_test_',
  )
})
