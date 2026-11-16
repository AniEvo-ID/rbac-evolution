/**
 * Type tests for the public API of the Kysely adapter. Most assertions are type-level: they (and the
 * `@ts-expect-error` lines) are checked by `tsc --noEmit` (the `typecheck` script). No database is opened:
 * the Kysely instance uses `DummyDriver`, and calls that would run SQL are never invoked.
 */
import { createRbac, type Rbac, type RbacAdapter } from '@anievo-id/rbac-evolution'
import {
  DummyDriver,
  Kysely,
  type Migration,
  type Selectable,
  type Insertable,
  type Transaction,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  type KyselyAdapterOptions,
  KyselyRbacAdapter,
  type ModelHasRolesTable,
  type PermissionsTable,
  type RbacDatabase,
  type RbacDialect,
  type RbacMigrationOptions,
  type RbacTableNames,
  type RbacTableOptions,
  type RolesTable,
  createRbacTables,
  detectDialect,
  dropRbacTables,
  kyselyAdapter,
  rbacMigration,
  tableNames,
} from '../src'

interface UsersTable {
  id: number
  email: string
}
interface AppDatabase extends RbacDatabase {
  users: UsersTable
}

/** A Kysely instance that never connects. */
const dummyDb = <DB>() =>
  new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  })

describe('kysely: types', () => {
  it('kyselyAdapter returns an RbacAdapter usable with createRbac', () => {
    const db = dummyDb<AppDatabase>()
    const adapter = kyselyAdapter(db)
    expect(adapter.dialect).toBe('postgres')
    expect(adapter.tables.roles).toBe('roles')

    expectTypeOf(adapter).toEqualTypeOf<KyselyRbacAdapter>()
    expectTypeOf(adapter).toMatchTypeOf<RbacAdapter>()
    expectTypeOf(adapter.dialect).toEqualTypeOf<RbacDialect>()
    expectTypeOf(adapter.tables).toEqualTypeOf<RbacTableNames>()

    const rbac = createRbac({ adapter, cache: false })
    expectTypeOf(rbac).toEqualTypeOf<Rbac>()
    const typed = createRbac<{ permissions: 'edit'; roles: 'writer' }>({ adapter: kyselyAdapter(db, { prefix: 'rbac_' }) })
    expectTypeOf(typed.for({ type: 'user', id: 1 }).can).toBeCallableWith('edit')
    const _typedNames = () => {
      // @ts-expect-error not a declared permission name
      void typed.for({ type: 'user', id: 1 }).can('fly')
    }
    expect(typeof _typedNames).toBe('function')

    expectTypeOf(KyselyRbacAdapter).constructorParameters.toEqualTypeOf<
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [db: Kysely<any>, options?: KyselyAdapterOptions]
    >()
  })

  it('accepts any Kysely<DB> and transactions, with or without the rbac tables', () => {
    expectTypeOf(kyselyAdapter).toBeCallableWith(dummyDb<AppDatabase>())
    expectTypeOf(kyselyAdapter).toBeCallableWith(dummyDb<{ users: UsersTable }>())
    expectTypeOf(kyselyAdapter).toBeCallableWith(dummyDb<RbacDatabase<'rbac_'>>(), { prefix: 'rbac_' })
    expectTypeOf<Transaction<AppDatabase>>().toMatchTypeOf<Parameters<typeof kyselyAdapter>[0]>()

    // Never called: only type-checked.
    const _bad = () => {
      // @ts-expect-error not a Kysely instance
      kyselyAdapter({})
      // @ts-expect-error not a Kysely instance
      createRbacTables({ schema: {} })
    }
    expect(typeof _bad).toBe('function')
  })

  it('KyselyAdapterOptions: dialect + prefix, exactOptionalPropertyTypes', () => {
    expectTypeOf<RbacDialect>().toEqualTypeOf<'postgres' | 'mysql' | 'sqlite' | 'mssql'>()
    expectTypeOf<KyselyAdapterOptions>().toEqualTypeOf<{ dialect?: RbacDialect; prefix?: string }>()
    expectTypeOf<RbacTableOptions>().toEqualTypeOf<{ prefix?: string }>()
    expectTypeOf<KyselyAdapterOptions>().toMatchTypeOf<RbacTableOptions>()
    expectTypeOf(kyselyAdapter).parameter(1).toEqualTypeOf<KyselyAdapterOptions | undefined>()

    const db = dummyDb<AppDatabase>()
    expectTypeOf(kyselyAdapter).toBeCallableWith(db, {})
    expectTypeOf(kyselyAdapter).toBeCallableWith(db, { dialect: 'mysql', prefix: 'rbac_' })
    expectTypeOf(kyselyAdapter).toBeCallableWith(db, { dialect: 'mssql' })

    // Never called: only type-checked.
    const _bad = () => {
      // @ts-expect-error unknown dialect (use 'postgres', not 'pg')
      kyselyAdapter(db, { dialect: 'pg' })
      // @ts-expect-error exactOptionalPropertyTypes: omit `dialect` instead of passing `undefined`
      kyselyAdapter(db, { dialect: undefined })
      // @ts-expect-error exactOptionalPropertyTypes: omit `prefix` instead of passing `undefined`
      kyselyAdapter(db, { prefix: undefined })
      // @ts-expect-error table names are not configurable, only the prefix
      kyselyAdapter(db, { tables: { roles: 'my_roles' } })
    }
    expect(typeof _bad).toBe('function')
  })

  it('schema helpers: createRbacTables, dropRbacTables, rbacMigration, tableNames', () => {
    expectTypeOf(createRbacTables).returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf(createRbacTables).parameter(1).toEqualTypeOf<RbacMigrationOptions | undefined>()
    expectTypeOf<RbacMigrationOptions>().toEqualTypeOf<{ dialect?: RbacDialect; prefix?: string }>()
    expectTypeOf(dropRbacTables).returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf(dropRbacTables).parameter(1).toEqualTypeOf<RbacTableOptions | undefined>()
    expectTypeOf(rbacMigration).returns.toEqualTypeOf<Migration>()
    expectTypeOf(detectDialect).returns.toEqualTypeOf<RbacDialect>()

    const db = dummyDb<AppDatabase>()
    expectTypeOf(createRbacTables).toBeCallableWith(db)
    expectTypeOf(createRbacTables).toBeCallableWith(db, { dialect: 'sqlite', prefix: 'rbac_' })
    expectTypeOf(rbacMigration).toBeCallableWith({ dialect: 'postgres' })

    const _bad = () => {
      // @ts-expect-error dropRbacTables only takes the prefix (dialect is detected)
      void dropRbacTables(db, { dialect: 'postgres' })
      // @ts-expect-error exactOptionalPropertyTypes
      void createRbacTables(db, { dialect: undefined })
    }
    expect(typeof _bad).toBe('function')

    const names = tableNames({ prefix: 'rbac_' })
    expect(names.modelHasRoles).toBe('rbac_model_has_roles')
    expectTypeOf(names).toEqualTypeOf<RbacTableNames>()
    expectTypeOf(detectDialect(db)).toEqualTypeOf<RbacDialect>()
  })

  it('RbacDatabase maps the table interfaces, with an optional prefix', () => {
    expectTypeOf<keyof RbacDatabase>().toEqualTypeOf<
      'permissions' | 'roles' | 'role_has_permissions' | 'model_has_roles' | 'model_has_permissions'
    >()
    expectTypeOf<keyof RbacDatabase<'rbac_'>>().toEqualTypeOf<
      'rbac_permissions' | 'rbac_roles' | 'rbac_role_has_permissions' | 'rbac_model_has_roles' | 'rbac_model_has_permissions'
    >()
    expectTypeOf<RbacDatabase['roles']>().toEqualTypeOf<RolesTable>()
    expectTypeOf<RbacDatabase<'rbac_'>['rbac_permissions']>().toEqualTypeOf<PermissionsTable>()

    // generated id / team id are optional on insert, required on select
    expectTypeOf<Selectable<RolesTable>['id']>().toEqualTypeOf<number>()
    expectTypeOf<Selectable<RolesTable>['team_id']>().toEqualTypeOf<string>()
    expectTypeOf<Insertable<RolesTable>>().toHaveProperty('team_id')
    expectTypeOf<{ name: string; guard_name: string }>().toMatchTypeOf<Insertable<RolesTable>>()
    expectTypeOf<{ role_id: number; subject_type: string; subject_id: string }>().toMatchTypeOf<
      Insertable<ModelHasRolesTable>
    >()

    // typed queries against the merged Database type compile
    const db = dummyDb<AppDatabase>()
    const query = db.selectFrom('roles').innerJoin('model_has_roles', 'model_has_roles.role_id', 'roles.id').select([
      'roles.name',
      'model_has_roles.subject_id',
    ])
    expect(query.compile().sql).toContain('"model_has_roles"')
    // @ts-expect-error the prefixed tables are not in an unprefixed RbacDatabase
    db.selectFrom('rbac_roles')
  })
})
