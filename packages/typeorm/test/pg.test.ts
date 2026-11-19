import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { describe } from 'vitest'
import { runDataSourceSuite, suiteOptions } from './shared'

const url = process.env.PG_URL

// Real PostgreSQL server, e.g. PG_URL=postgres://postgres:postgres@localhost:5432/postgres
describe.skipIf(url === undefined || url === '')('typeorm (PostgreSQL via pg, PG_URL)', () => {
  runDataSourceSuite(
    'typeorm (PostgreSQL via pg)',
    'postgres',
    () => new DataSource({ type: 'postgres', url: url!, ...suiteOptions('typeorm_test_') }),
    'typeorm_test_',
  )
})
