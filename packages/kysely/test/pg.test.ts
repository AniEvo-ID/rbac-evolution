import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { describe } from 'vitest'
import { runSharedDatabaseSuite } from './shared'

const url = process.env.PG_URL

// Real PostgreSQL server, e.g. PG_URL=postgres://postgres:postgres@localhost:5432/postgres
describe.skipIf(url === undefined || url === '')('kysely (PostgreSQL via pg, PG_URL)', () => {
  runSharedDatabaseSuite(
    'kysely (PostgreSQL via pg)',
    'postgres',
    () => new Kysely<any>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url, max: 4 }) }) }),
    'kysely_test_',
  )
})
