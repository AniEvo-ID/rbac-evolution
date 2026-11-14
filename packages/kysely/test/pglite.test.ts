import { PGlite } from '@electric-sql/pglite'
import { Kysely } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'
import { describe } from 'vitest'
import { runSharedDatabaseSuite } from './shared'

// In-process PostgreSQL (WASM): covers the `postgres` code paths without a server.
describe('kysely (PostgreSQL via PGlite)', () => {
  runSharedDatabaseSuite(
    'kysely (PostgreSQL via PGlite)',
    'postgres',
    () => new Kysely<any>({ dialect: new PGliteDialect(new PGlite()) }),
    '',
  )
})
