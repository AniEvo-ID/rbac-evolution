import * as kysely from 'kysely'
import type { RbacMigration } from '../src'

/** The part of Kysely's `Migrator` the tests use. Same on 0.28 and 0.29. */
export interface TestMigrator {
  migrateToLatest(): Promise<{ error?: unknown }>
  migrateDown(): Promise<{ error?: unknown }>
}

type MigratorClass = new (props: {
  db: kysely.Kysely<any>
  provider: { getMigrations(): Promise<Record<string, RbacMigration>> }
}) => TestMigrator

/**
 * Kysely's `Migrator`: from `kysely` on 0.28 (which has no `kysely/migration`), or from `kysely/migration` on 0.29
 * (where `kysely` no longer exports it). Typed structurally, as each version's own type only exists on that version.
 */
export async function loadMigrator(): Promise<MigratorClass> {
  const root = (kysely as Record<string, unknown>).Migrator
  if (typeof root === 'function') return root as MigratorClass
  const specifier = 'kysely/migration'
  const sub = (await import(/* @vite-ignore */ specifier)) as { Migrator: MigratorClass }
  return sub.Migrator
}
