/**
 * Type tests for the public API of the Prisma adapter. Most assertions are type-level: they (and the
 * `@ts-expect-error` lines) are checked by `tsc --noEmit` (the `typecheck` script, which generates the
 * test clients first). The generated clients are imported as types only, so no engine or database is loaded;
 * functions that need a real client take it as a parameter and are never called.
 */
import { createRbac, type Rbac, type RbacAdapter } from '@anievo-id/rbac-evolution'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  PrismaAdapter,
  type PrismaAdapterOptions,
  type PrismaRbacClient,
  type PrismaRbacModelHasPermissionDelegate,
  type PrismaRbacModelHasRoleDelegate,
  type PrismaRbacPermissionDelegate,
  type PrismaRbacRoleDelegate,
  type PrismaRbacRoleHasPermissionDelegate,
} from '../src'
import type { Prisma as SqlitePrisma, PrismaClient as SqliteClient } from './generated'
import type { PrismaClient as LegacyClient } from './generated-legacy'
import type { Prisma as MysqlPrisma, PrismaClient as MysqlClient } from './generated-mysql'
import type { Prisma as PgPrisma, PrismaClient as PgClient } from './generated-pg'

/** A structural client that never touches a database. */
const fakeClient = (): PrismaRbacClient => {
  const delegate = {
    findMany: async () => [],
    create: async () => {
      throw new Error('not implemented')
    },
    createMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
  }
  const links = { ...delegate, groupBy: async () => [] }
  return {
    rbacPermission: delegate,
    rbacRole: delegate,
    rbacRoleHasPermission: delegate,
    rbacModelHasRole: links,
    rbacModelHasPermission: links,
  }
}

describe('prisma: types', () => {
  it('PrismaAdapter is an RbacAdapter usable with createRbac', () => {
    const adapter = new PrismaAdapter(fakeClient())
    expectTypeOf(adapter).toMatchTypeOf<RbacAdapter>()
    const rbac = createRbac({ adapter, cache: false })
    expectTypeOf(rbac).toEqualTypeOf<Rbac>()
    expect(rbac).toBeDefined()

    expectTypeOf(PrismaAdapter).constructorParameters.toEqualTypeOf<
      [prisma: PrismaRbacClient, options?: PrismaAdapterOptions]
    >()
  })

  it('accepts the generated clients (SQLite, PostgreSQL, MySQL) and their transaction clients', () => {
    // guard against a missing/ungenerated client silently resolving to `any`
    expectTypeOf<SqliteClient>().not.toBeAny()
    expectTypeOf<PgClient>().not.toBeAny()
    expectTypeOf<MysqlClient>().not.toBeAny()

    expectTypeOf<SqliteClient>().toMatchTypeOf<PrismaRbacClient>()
    expectTypeOf<PgClient>().toMatchTypeOf<PrismaRbacClient>()
    expectTypeOf<MysqlClient>().toMatchTypeOf<PrismaRbacClient>()
    // A client generated from the 1.1 models (no `expiresAt`) still fits: 1.2 added no field to these types.
    expectTypeOf<LegacyClient>().not.toBeAny()
    expectTypeOf<LegacyClient>().toMatchTypeOf<PrismaRbacClient>()

    // `prisma.$transaction(async (tx) => ...)`: no `$transaction` on `tx`
    expectTypeOf<SqlitePrisma.TransactionClient>().toMatchTypeOf<PrismaRbacClient>()
    expectTypeOf<PgPrisma.TransactionClient>().toMatchTypeOf<PrismaRbacClient>()
    expectTypeOf<MysqlPrisma.TransactionClient>().toMatchTypeOf<PrismaRbacClient>()

    // each delegate on its own, including `groupBy({ by: ['subjectType', 'subjectId', 'teamId'] })`
    expectTypeOf<SqliteClient['rbacPermission']>().toMatchTypeOf<PrismaRbacPermissionDelegate>()
    expectTypeOf<SqliteClient['rbacRole']>().toMatchTypeOf<PrismaRbacRoleDelegate>()
    expectTypeOf<SqliteClient['rbacRoleHasPermission']>().toMatchTypeOf<PrismaRbacRoleHasPermissionDelegate>()
    expectTypeOf<SqliteClient['rbacModelHasRole']>().toMatchTypeOf<PrismaRbacModelHasRoleDelegate>()
    expectTypeOf<SqliteClient['rbacModelHasPermission']>().toMatchTypeOf<PrismaRbacModelHasPermissionDelegate>()
    expectTypeOf<PgClient['rbacModelHasRole']>().toMatchTypeOf<PrismaRbacModelHasRoleDelegate>()
    expectTypeOf<MysqlClient['rbacModelHasPermission']>().toMatchTypeOf<PrismaRbacModelHasPermissionDelegate>()

    // Never called: needs a real client.
    const _usage = (sqlite: SqliteClient, pg: PgClient, mysql: MysqlClient) => {
      const a = createRbac({ adapter: new PrismaAdapter(sqlite) })
      const b = createRbac({ adapter: new PrismaAdapter(pg, { skipDuplicates: true }) })
      const c = createRbac<{ permissions: 'edit'; roles: 'writer' }>({ adapter: new PrismaAdapter(mysql) })
      void pg.$transaction(async (tx) => {
        await createRbac({ adapter: new PrismaAdapter(tx), cache: false }).deleteRole('writer')
      })
      // client extensions keep the rbac delegates
      const extended = pg.$extends({ query: { $allOperations: ({ args, query }) => query(args) } })
      const d = createRbac({ adapter: new PrismaAdapter(extended) })
      return [a, b, c, d]
    }
    expect(typeof _usage).toBe('function')
  })

  it('rejects clients without the rbac models', () => {
    type WithoutRoles = Omit<SqliteClient, 'rbacRole'>
    expectTypeOf<WithoutRoles>().not.toMatchTypeOf<PrismaRbacClient>()

    // Never called: only type-checked.
    const _bad = (client: WithoutRoles, sqlite: SqliteClient) => {
      // @ts-expect-error missing `rbacRole`
      new PrismaAdapter(client)
      // @ts-expect-error not a client
      new PrismaAdapter({})
      // @ts-expect-error a delegate whose groupBy has another `by` is not an rbac link delegate
      new PrismaAdapter({ ...sqlite, rbacModelHasRole: { ...sqlite.rbacModelHasRole, groupBy: (_: { by: ['roleId'] }) => Promise.resolve([]) } })
    }
    expect(typeof _bad).toBe('function')
  })

  it('PrismaAdapterOptions: skipDuplicates, expiry, exactOptionalPropertyTypes', () => {
    expectTypeOf<PrismaAdapterOptions>().toEqualTypeOf<{ skipDuplicates?: boolean; expiry?: boolean }>()
    expectTypeOf(PrismaAdapter).toBeConstructibleWith(fakeClient(), { expiry: true })
    expectTypeOf(PrismaAdapter).toBeConstructibleWith(fakeClient())
    expectTypeOf(PrismaAdapter).toBeConstructibleWith(fakeClient(), {})
    expectTypeOf(PrismaAdapter).toBeConstructibleWith(fakeClient(), { skipDuplicates: true })
    expect(new PrismaAdapter(fakeClient(), { skipDuplicates: false })).toBeInstanceOf(PrismaAdapter)

    // Never called: only type-checked.
    const _bad = () => {
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      new PrismaAdapter(fakeClient(), { skipDuplicates: undefined })
      // @ts-expect-error must be a boolean
      new PrismaAdapter(fakeClient(), { skipDuplicates: 'yes' })
      // @ts-expect-error unknown option
      new PrismaAdapter(fakeClient(), { prefix: 'rbac_' })
    }
    expect(typeof _bad).toBe('function')
  })

  it('PrismaRbacClient: $transaction is optional, delegates are structural', () => {
    expectTypeOf<PrismaRbacClient>().toHaveProperty('rbacModelHasRole')
    expectTypeOf<Omit<PrismaRbacClient, '$transaction'>>().toMatchTypeOf<PrismaRbacClient>()
    expectTypeOf<Parameters<PrismaRbacModelHasRoleDelegate['groupBy']>[0]['by']>().toEqualTypeOf<
      ['subjectType', 'subjectId', 'teamId']
    >()
    expectTypeOf<ReturnType<PrismaRbacModelHasPermissionDelegate['groupBy']>>().toEqualTypeOf<
      PromiseLike<{ subjectType: string; subjectId: string; teamId: string }[]>
    >()
  })
})
