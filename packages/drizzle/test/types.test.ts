/**
 * Type tests for the public API of the Drizzle adapter. Most assertions are type-level: they (and the
 * `@ts-expect-error` lines) are checked by `tsc --noEmit` (the `typecheck` script). No database is opened:
 * functions that need a real Drizzle db take it as a parameter and are never called.
 */
import { createRbac, type Rbac, type RbacAdapter } from '@anievo-id/rbac-evolution'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import { describe, expect, expectTypeOf, it } from 'vitest'
import * as root from '../src'
import * as mysqlEntry from '../src/mysql'
import * as pgEntry from '../src/pg'
import * as sqliteEntry from '../src/sqlite'
import {
  type DrizzleAdapterOptions,
  type DrizzleDialect,
  type MysqlRbacExpirySchema,
  type PgRbacExpirySchema,
  type SqliteRbacExpirySchema,
  DrizzleRbacAdapter,
  type MysqlRbacSchema,
  type PgRbacSchema,
  type RbacSchemaOptions,
  type RbacTableNames,
  type RbacTables,
  type SqliteRbacSchema,
  drizzleMysqlAdapter,
  drizzlePgAdapter,
  drizzleSqliteAdapter,
  mysqlRbacSchema,
  pgRbacSchema,
  sqliteRbacSchema,
} from '../src'

type PgTx = Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0]
type SqliteTx = Parameters<Parameters<LibSQLDatabase['transaction']>[0]>[0]
type MysqlTx = Parameters<Parameters<MySql2Database['transaction']>[0]>[0]

describe('drizzle: types', () => {
  it('entry points export the same factories as the root entry', () => {
    expect(pgEntry.drizzlePgAdapter).toBe(root.drizzlePgAdapter)
    expect(pgEntry.pgRbacSchema).toBe(root.pgRbacSchema)
    expect(sqliteEntry.drizzleSqliteAdapter).toBe(root.drizzleSqliteAdapter)
    expect(sqliteEntry.sqliteRbacSchema).toBe(root.sqliteRbacSchema)
    expect(mysqlEntry.drizzleMysqlAdapter).toBe(root.drizzleMysqlAdapter)
    expect(mysqlEntry.mysqlRbacSchema).toBe(root.mysqlRbacSchema)

    expectTypeOf<pgEntry.PgRbacSchema>().toEqualTypeOf<PgRbacSchema>()
    expectTypeOf<sqliteEntry.SqliteRbacSchema>().toEqualTypeOf<SqliteRbacSchema>()
    expectTypeOf<mysqlEntry.MysqlRbacSchema>().toEqualTypeOf<MysqlRbacSchema>()
    expectTypeOf<pgEntry.RbacSchemaOptions>().toEqualTypeOf<RbacSchemaOptions>()
    expectTypeOf<sqliteEntry.RbacSchemaOptions>().toEqualTypeOf<RbacSchemaOptions>()
    expectTypeOf<mysqlEntry.RbacSchemaOptions>().toEqualTypeOf<RbacSchemaOptions>()
  })

  it('factories return an RbacAdapter usable with createRbac', () => {
    expectTypeOf(drizzlePgAdapter).returns.toEqualTypeOf<RbacAdapter>()
    expectTypeOf(drizzleSqliteAdapter).returns.toEqualTypeOf<RbacAdapter>()
    expectTypeOf(drizzleMysqlAdapter).returns.toEqualTypeOf<RbacAdapter>()
    expectTypeOf<DrizzleRbacAdapter>().toMatchTypeOf<RbacAdapter>()

    // Never called: needs real databases.
    const _usage = (pg: NodePgDatabase, sqlite: LibSQLDatabase, mysql: MySql2Database) => {
      const a: Rbac = createRbac({ adapter: drizzlePgAdapter(pg) })
      const b = createRbac({ adapter: drizzleSqliteAdapter(sqlite, sqliteRbacSchema({ prefix: 'rbac_' })) })
      const c = createRbac<{ permissions: 'edit'; roles: 'writer' }>({ adapter: drizzleMysqlAdapter(mysql) })
      return [a, b, c]
    }
    expect(typeof _usage).toBe('function')
  })

  it('each factory accepts the Drizzle databases (and transactions) of its dialect', () => {
    expectTypeOf(drizzlePgAdapter).toBeCallableWith({} as NodePgDatabase)
    expectTypeOf(drizzlePgAdapter).toBeCallableWith({} as PgliteDatabase, pgRbacSchema())
    expectTypeOf(drizzlePgAdapter).toBeCallableWith({} as NodePgDatabase<{ users: never }>)
    expectTypeOf<PgTx>().toMatchTypeOf<Parameters<typeof drizzlePgAdapter>[0]>()

    expectTypeOf(drizzleSqliteAdapter).toBeCallableWith({} as LibSQLDatabase)
    expectTypeOf(drizzleSqliteAdapter).toBeCallableWith({} as LibSQLDatabase, sqliteRbacSchema())
    expectTypeOf<SqliteTx>().toMatchTypeOf<Parameters<typeof drizzleSqliteAdapter>[0]>()

    expectTypeOf(drizzleMysqlAdapter).toBeCallableWith({} as MySql2Database)
    expectTypeOf(drizzleMysqlAdapter).toBeCallableWith({} as MySql2Database, mysqlRbacSchema())
    expectTypeOf<MysqlTx>().toMatchTypeOf<Parameters<typeof drizzleMysqlAdapter>[0]>()

    // the schema argument is optional; it may be the expiry variant (1.2), with `{ expiry: true }` as options
    expectTypeOf(drizzlePgAdapter).parameter(1).toEqualTypeOf<PgRbacSchema | PgRbacExpirySchema | undefined>()
    expectTypeOf(drizzleSqliteAdapter).parameter(1).toEqualTypeOf<SqliteRbacSchema | SqliteRbacExpirySchema | undefined>()
    expectTypeOf(drizzleMysqlAdapter).parameter(1).toEqualTypeOf<MysqlRbacSchema | MysqlRbacExpirySchema | undefined>()
    expectTypeOf(drizzlePgAdapter).parameter(2).toEqualTypeOf<DrizzleAdapterOptions | undefined>()
    expectTypeOf<DrizzleAdapterOptions>().toEqualTypeOf<{ expiry?: boolean }>()
    expectTypeOf(drizzlePgAdapter).toBeCallableWith({} as NodePgDatabase, pgRbacSchema({ expiry: true }), { expiry: true })
    expectTypeOf(drizzleSqliteAdapter).toBeCallableWith({} as LibSQLDatabase, sqliteRbacSchema({ expiry: true }), {
      expiry: true,
    })
    expectTypeOf(drizzleMysqlAdapter).toBeCallableWith({} as MySql2Database, mysqlRbacSchema({ expiry: true }), {
      expiry: true,
    })
  })

  it('rejects a database or schema of another dialect', () => {
    // Never called: only type-checked.
    const _wrongDb = (pg: NodePgDatabase, sqlite: LibSQLDatabase, mysql: MySql2Database) => {
      // @ts-expect-error a SQLite db is not a PostgreSQL db
      drizzlePgAdapter(sqlite)
      // @ts-expect-error a MySQL db is not a PostgreSQL db
      drizzlePgAdapter(mysql)
      // @ts-expect-error a PostgreSQL db is not a SQLite db
      drizzleSqliteAdapter(pg)
      // @ts-expect-error a MySQL db is not a SQLite db
      drizzleSqliteAdapter(mysql)
      // @ts-expect-error a PostgreSQL db is not a MySQL db
      drizzleMysqlAdapter(pg)
      // @ts-expect-error a SQLite db is not a MySQL db
      drizzleMysqlAdapter(sqlite)

      // @ts-expect-error SQLite tables with a PostgreSQL adapter
      drizzlePgAdapter(pg, sqliteRbacSchema())
      // @ts-expect-error PostgreSQL tables with a SQLite adapter
      drizzleSqliteAdapter(sqlite, pgRbacSchema())
      // @ts-expect-error PostgreSQL tables with a MySQL adapter
      drizzleMysqlAdapter(mysql, pgRbacSchema())
      // @ts-expect-error not a database
      drizzlePgAdapter({})
    }
    expect(typeof _wrongDb).toBe('function')
  })

  it('schema factories take RbacSchemaOptions (prefix, expiry)', () => {
    expectTypeOf<RbacSchemaOptions>().toEqualTypeOf<{ prefix?: string; expiry?: boolean }>()
    // `{ expiry: true }` picks the overload with the `expiresAt` column; anything else the 1.1 tables.
    expectTypeOf(pgRbacSchema({ expiry: true })).toEqualTypeOf<PgRbacExpirySchema>()
    expectTypeOf(pgRbacSchema({ prefix: 'x' })).toEqualTypeOf<PgRbacSchema>()
    expectTypeOf(sqliteRbacSchema({ expiry: true })).toEqualTypeOf<SqliteRbacExpirySchema>()
    expectTypeOf(mysqlRbacSchema({ expiry: true })).toEqualTypeOf<MysqlRbacExpirySchema>()
    expectTypeOf(mysqlRbacSchema()).toEqualTypeOf<MysqlRbacSchema>()

    expectTypeOf(pgRbacSchema).toBeCallableWith()
    expectTypeOf(pgRbacSchema).toBeCallableWith({})
    expectTypeOf(pgRbacSchema).toBeCallableWith({ prefix: 'rbac_' })

    // Never called: only type-checked.
    const _badOptions = () => {
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      pgRbacSchema({ prefix: undefined })
      // @ts-expect-error table names are not configurable, only the prefix
      sqliteRbacSchema({ tables: { roles: 'my_roles' } })
      // @ts-expect-error prefix must be a string
      mysqlRbacSchema({ prefix: 1 })
    }
    expect(typeof _badOptions).toBe('function')

    expectTypeOf<keyof RbacTableNames>().toEqualTypeOf<
      'permissions' | 'roles' | 'roleHasPermissions' | 'modelHasRoles' | 'modelHasPermissions'
    >()
    expectTypeOf<DrizzleDialect>().toEqualTypeOf<'pg' | 'sqlite' | 'mysql'>()
  })

  it('schemas have the five tables, structurally compatible with RbacTables', () => {
    const pg = pgRbacSchema({ prefix: 'rbac_' })
    const sqlite = sqliteRbacSchema()
    const mysql = mysqlRbacSchema()
    expect(Object.keys(pg).sort()).toEqual(
      ['modelHasPermissions', 'modelHasRoles', 'permissions', 'roleHasPermissions', 'roles'],
    )

    expectTypeOf(pg).toEqualTypeOf<PgRbacSchema>()
    expectTypeOf(sqlite).toEqualTypeOf<SqliteRbacSchema>()
    expectTypeOf(mysql).toEqualTypeOf<MysqlRbacSchema>()
    for (const schema of [pg, sqlite, mysql]) {
      expectTypeOf(schema).toMatchTypeOf<RbacTables>()
      expectTypeOf<keyof typeof schema>().toEqualTypeOf<keyof RbacTables>()
    }
    for (const schema of [pgRbacSchema({ expiry: true }), sqliteRbacSchema({ expiry: true }), mysqlRbacSchema({ expiry: true })]) {
      expectTypeOf(schema).toMatchTypeOf<RbacTables>()
    }
    expect('expiresAt' in pgRbacSchema({ expiry: true }).modelHasRoles).toBe(true)
    expect('expiresAt' in pgRbacSchema().modelHasRoles).toBe(false)
  })

  it('table row types ($inferSelect / $inferInsert)', () => {
    type PermissionRow = { id: number; name: string; guardName: string; createdAt: Date; updatedAt: Date }
    type RoleRow = { id: number; name: string; guardName: string; teamId: string; createdAt: Date; updatedAt: Date }
    type SubjectRoleRow = { roleId: number; subjectType: string; subjectId: string; teamId: string }
    type SubjectPermissionRow = { permissionId: number; subjectType: string; subjectId: string; teamId: string }

    for (const _ of [] as (PgRbacSchema | SqliteRbacSchema | MysqlRbacSchema)[]) {
      expectTypeOf(_.permissions.$inferSelect).toEqualTypeOf<PermissionRow>()
      expectTypeOf(_.roles.$inferSelect).toEqualTypeOf<RoleRow>()
      expectTypeOf(_.roleHasPermissions.$inferSelect).toEqualTypeOf<{ roleId: number; permissionId: number }>()
      expectTypeOf(_.modelHasRoles.$inferSelect).toEqualTypeOf<SubjectRoleRow>()
      expectTypeOf(_.modelHasPermissions.$inferSelect).toEqualTypeOf<SubjectPermissionRow>()
    }

    // id, timestamps and team id have defaults; name / guard name are required on insert
    expectTypeOf<PgRbacSchema['roles']['$inferInsert']>().toEqualTypeOf<{
      name: string
      guardName: string
      id?: number
      teamId?: string
      createdAt?: Date
      updatedAt?: Date
    }>()
    expectTypeOf<SqliteRbacSchema['modelHasRoles']['$inferInsert']>().toEqualTypeOf<{
      roleId: number
      subjectType: string
      subjectId: string
      teamId?: string
    }>()
    // The expiry tables add one nullable column, optional on insert.
    for (const _ of [] as (PgRbacExpirySchema | SqliteRbacExpirySchema | MysqlRbacExpirySchema)[]) {
      expectTypeOf(_.modelHasRoles.$inferSelect).toEqualTypeOf<{
        roleId: number
        subjectType: string
        subjectId: string
        teamId: string
        expiresAt: Date | null
      }>()
      expectTypeOf<(typeof _.modelHasPermissions.$inferInsert)['expiresAt']>().toEqualTypeOf<Date | null | undefined>()
    }
    expectTypeOf<MysqlRbacSchema['permissions']['$inferInsert']>().toEqualTypeOf<{
      name: string
      guardName: string
      id?: number
      createdAt?: Date
      updatedAt?: Date
    }>()
  })
})
