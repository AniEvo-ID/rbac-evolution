import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

// `@anievo-id/rbac-evolution/testing` is written against vitest's API. Bun's test runner
// has the same describe/it/expect/beforeEach surface, so point the import at bun:test
// and run the exact same adapter conformance suite under Bun.
mock.module('vitest', () => ({ beforeEach, describe, expect, it }))

/** Fresh in-memory bun:sqlite database with the rbac tables from the shipped DDL. */
export async function createSqliteDb(): Promise<Database> {
  const ddl = await Bun.file(new URL('../../packages/drizzle/sql/sqlite.sql', import.meta.url)).text()
  const db = new Database(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  const statements = ddl
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const statement of statements) db.exec(statement)
  return db
}
