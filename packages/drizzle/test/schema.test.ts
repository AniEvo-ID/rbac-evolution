// The `{ expiry: true }` schemas must be the 1.1 tables plus one nullable `expires_at` column on each link table:
// same table names, primary keys, indexes and foreign keys. getTableConfig() also runs the lazy `references()` and
// extra-config callbacks, which only drizzle-kit calls otherwise.
import { getTableConfig as mysqlConfig } from 'drizzle-orm/mysql-core'
import { getTableConfig as pgConfig } from 'drizzle-orm/pg-core'
import { getTableConfig as sqliteConfig } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'
import { mysqlRbacSchema } from '../src/mysql-schema'
import { pgRbacSchema } from '../src/pg-schema'
import { sqliteRbacSchema } from '../src/sqlite-schema'

type Config = {
  name: string
  columns: readonly { name: string; notNull: boolean }[]
  primaryKeys: readonly { getName(): string; columns: readonly { name: string }[] }[]
  indexes: readonly { config: { name: string; unique: boolean; columns: readonly unknown[] } }[]
  foreignKeys: readonly { getName(): string; reference(): { columns: readonly { name: string }[]; foreignColumns: readonly { name: string }[] } }[]
}

/** The parts of a table config that make up its DDL, comparable across the two variants. */
const shape = (config: Config) => ({
  name: config.name,
  columns: config.columns.map((c) => `${c.name}${c.notNull ? ' not null' : ''}`).sort(),
  primaryKeys: config.primaryKeys.map((pk) => `${pk.getName()}(${pk.columns.map((c) => c.name).join(',')})`),
  indexes: config.indexes.map((i) => `${i.config.name}${i.config.unique ? ' unique' : ''}:${i.config.columns.length}`).sort(),
  foreignKeys: config.foreignKeys
    .map((fk) => {
      const ref = fk.reference()
      return `${fk.getName()}:${ref.columns.map((c) => c.name).join(',')}->${ref.foreignColumns.map((c) => c.name).join(',')}`
    })
    .sort(),
})

type TableKey = 'permissions' | 'roles' | 'roleHasPermissions' | 'modelHasRoles' | 'modelHasPermissions'
type Dialect = {
  name: string
  schema: (options: { prefix?: string; expiry?: boolean }) => Record<TableKey, unknown>
  config: (table: never) => unknown
}

const dialects: Dialect[] = [
  { name: 'pg', schema: pgRbacSchema, config: pgConfig },
  { name: 'mysql', schema: mysqlRbacSchema, config: mysqlConfig },
  { name: 'sqlite', schema: sqliteRbacSchema, config: sqliteConfig },
]

describe.each(dialects)('$name expiry schema', ({ schema, config }) => {
  const read = (table: unknown) => shape(config(table as never) as Config)

  for (const options of [{}, { prefix: 'app_' }] as { prefix?: string }[]) {
    it(`matches the 1.1 tables plus expires_at ${JSON.stringify(options)}`, () => {
      const plain = schema(options)
      const expiry = schema({ ...options, expiry: true })

      expect(read(expiry.modelHasRoles).name).toBe(`${options.prefix ?? ''}model_has_roles`)
      for (const key of ['permissions', 'roles', 'roleHasPermissions'] as const) {
        expect(read(expiry[key])).toEqual(read(plain[key]))
      }
      for (const key of ['modelHasRoles', 'modelHasPermissions'] as const) {
        const before = read(plain[key])
        const after = read(expiry[key])
        expect(after).toEqual({ ...before, columns: [...before.columns, 'expires_at'].sort() })
      }
    })
  }
})
