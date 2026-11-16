import { PGlite } from '@electric-sql/pglite'
import * as kysely from 'kysely'
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

// Kysely 0.29 ships its own PGlite dialect (one connection, behind a mutex). Not in 0.28.
type BuiltInPGliteDialect = new (config: { pglite: PGlite }) => kysely.Dialect
const BuiltIn = (kysely as Record<string, unknown>).PGliteDialect as BuiltInPGliteDialect | undefined

describe.skipIf(BuiltIn === undefined)("kysely (PostgreSQL via kysely's PGliteDialect, 0.29+)", () => {
  runSharedDatabaseSuite(
    "kysely (PostgreSQL via kysely's PGliteDialect)",
    'postgres',
    () => new Kysely<any>({ dialect: new (BuiltIn as BuiltInPGliteDialect)({ pglite: new PGlite() }) }),
    '',
  )
})
