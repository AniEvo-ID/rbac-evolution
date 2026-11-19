import 'reflect-metadata'
import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { DataSource } from 'typeorm'
import { describe, expect, it } from 'vitest'
import { rbacExpiryMigration, rbacMigration, typeormAdapter, typeormDialect } from '../src'

/** Fresh in-memory database per call, with the tables created by the TypeORM migration. */
async function freshDataSource(options: { prefix?: string; expiry?: boolean; migrations?: (new () => unknown)[] } = {}) {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    migrations: options.migrations ?? [rbacMigration({ prefix: options.prefix, expiry: options.expiry })],
  })
  await ds.initialize()
  await ds.runMigrations()
  return ds
}

const tables = async (ds: DataSource): Promise<string[]> =>
  (
    await ds.query(`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name`)
  ).map((row: { name: string }) => row.name)

runAdapterTests('typeorm (SQLite via better-sqlite3)', async () => typeormAdapter(await freshDataSource()))

runAdapterTests('typeorm (SQLite via better-sqlite3, expiry)', async () =>
  typeormAdapter(await freshDataSource({ expiry: true }), { expiry: true }),
)

runAdapterTests('typeorm (SQLite via better-sqlite3, EntityManager)', async () =>
  typeormAdapter((await freshDataSource()).manager),
)

describe('typeorm sqlite: specifics', () => {
  it('rbacMigration creates the five tables, and its down() drops them', async () => {
    const ds = await freshDataSource()
    expect(await tables(ds)).toEqual([
      'migrations',
      'model_has_permissions',
      'model_has_roles',
      'permissions',
      'role_has_permissions',
      'roles',
    ])
    await ds.undoLastMigration()
    expect(await tables(ds)).toEqual(['migrations'])
  })

  it('names the migrations so TypeORM accepts them', async () => {
    const ds = await freshDataSource({ migrations: [rbacMigration({ name: 'Rbac1700000000000' }), rbacExpiryMigration()] })
    const names = (await ds.query('select name from migrations order by id')).map((row: { name: string }) => row.name)
    expect(names).toEqual(['Rbac1700000000000', 'RbacEvolutionExpiry1763510400001'])
  })

  it('rbacExpiryMigration adds and removes the expires_at columns', async () => {
    const ds = await freshDataSource({ migrations: [rbacMigration(), rbacExpiryMigration()] })
    const columns = async () =>
      (await ds.query(`select name from pragma_table_info('model_has_roles')`)).map((row: { name: string }) => row.name)
    expect(await columns()).toContain('expires_at')
    const rbac = createRbac({ adapter: typeormAdapter(ds, { expiry: true }), cache: false })
    await rbac.createRole('writer')
    await rbac.for({ type: 'user', id: 1 }).assignRole('writer', { expiresAt: new Date(Date.now() + 60_000) })
    expect(await rbac.for({ type: 'user', id: 1 }).hasRole('writer')).toBe(true)
    await ds.undoLastMigration()
    expect(await columns()).not.toContain('expires_at')
  })

  it('uses prefixed tables', async () => {
    const ds = await freshDataSource({ prefix: 'rbac_' })
    const rbac = createRbac({ adapter: typeormAdapter(ds, { prefix: 'rbac_' }), cache: false })
    await rbac.createPermission('edit')
    await rbac.createRole('writer')
    await rbac.role('writer').givePermissionTo('edit')
    await rbac.for({ type: 'user', id: 7 }).assignRole('writer')
    expect(await rbac.for({ type: 'user', id: 7 }).can('edit')).toBe(true)
    expect(await tables(ds)).toContain('rbac_model_has_roles')
    expect(await tables(ds)).not.toContain('roles')
  })

  it('joins the transaction of an EntityManager: a rollback undoes the rbac writes', async () => {
    const ds = await freshDataSource()
    const rbac = createRbac({ adapter: typeormAdapter(ds), cache: false })
    await rbac.createRole('writer')
    await expect(
      ds.transaction(async (manager) => {
        const tx = createRbac({ adapter: typeormAdapter(manager), cache: false })
        await tx.for({ type: 'user', id: 1 }).assignRole('writer')
        expect(await tx.for({ type: 'user', id: 1 }).hasRole('writer')).toBe(true)
        throw new Error('rollback')
      }),
    ).rejects.toThrow('rollback')
    expect(await rbac.for({ type: 'user', id: 1 }).hasRole('writer')).toBe(false)
  })

  it('rejects a driver it does not support', () => {
    expect(() => typeormAdapter({ options: { type: 'mongodb' }, createQueryRunner: () => ({}) as never })).toThrow(
      /"mongodb" driver is not supported/,
    )
  })

  it('rejects something that is neither a DataSource nor an EntityManager', () => {
    expect(() => typeormAdapter({} as never)).toThrow(/expected a TypeORM DataSource or EntityManager/)
  })
})

/** A query runner that records what it is asked, for the parts no local server covers. */
function fakeRunner(result: unknown, active = false) {
  const calls: { sql: string; parameters: unknown[] }[] = []
  const log: string[] = []
  return {
    calls,
    log,
    runner: {
      isTransactionActive: active,
      query: async (sql: string, parameters: unknown[] = []) => {
        calls.push({ sql, parameters })
        return result
      },
      startTransaction: async () => void log.push('start'),
      commitTransaction: async () => void log.push('commit'),
      rollbackTransaction: async () => void log.push('rollback'),
      release: async () => void log.push('release'),
    },
  }
}

describe('typeorm dialect', () => {
  it('numbers SQL Server parameters from 0, as TypeORM binds them', async () => {
    const fake = fakeRunner({ records: [{ id: 5 }], affected: 1 })
    const adapter = typeormAdapter({ options: { type: 'mssql' }, createQueryRunner: () => fake.runner })
    await adapter.findRoles({ names: ['a', 'b'], guardName: 'web' })
    expect(fake.calls[0]?.sql).toMatch(/@0.*@1.*@2/)
    expect(fake.calls[0]?.sql).not.toMatch(/@3/)
    expect(fake.calls[0]?.parameters).toEqual(['a', 'b', 'web'])
    expect(fake.log).toEqual(['release'])
  })

  it("reads MySQL's insertId", async () => {
    const fake = fakeRunner({ records: [], affected: 1, raw: { insertId: 42 } })
    const adapter = typeormAdapter({ options: { type: 'mariadb' }, createQueryRunner: () => fake.runner })
    expect((await adapter.createPermission({ name: 'edit', guardName: 'web' })).id).toBe(42)
  })

  it('accepts a 0.3 EntityManager (`connection`, not `dataSource`)', async () => {
    const fake = fakeRunner({ records: [] })
    const manager = { connection: { options: { type: 'postgres' }, createQueryRunner: () => fake.runner } }
    expect(await typeormAdapter(manager).findPermissions()).toEqual([])
    expect(fake.calls[0]?.sql).toMatch(/^select .* from "permissions"/)
  })

  it('starts and commits its own transaction on a runner without one, and never releases a runner it did not create', async () => {
    const fake = fakeRunner({ records: [], affected: 0 })
    const manager = { queryRunner: fake.runner, dataSource: { options: { type: 'postgres' }, createQueryRunner: () => fake.runner } }
    await typeormAdapter(manager).deleteRole(1)
    expect(fake.log).toEqual(['start', 'commit'])
  })

  it('rolls back its own transaction when a query fails', async () => {
    const fake = fakeRunner({ records: [] })
    fake.runner.query = async () => {
      throw new Error('boom')
    }
    const ds = { options: { type: 'postgres' }, createQueryRunner: () => fake.runner }
    await expect(typeormAdapter(ds).deleteRole(1)).rejects.toThrow('boom')
    expect(fake.log).toEqual(['start', 'rollback', 'release'])
  })

  it('does not stream', async () => {
    const fake = fakeRunner({ records: [] })
    const driver = typeormDialect({ options: { type: 'postgres' }, createQueryRunner: () => fake.runner }).createDriver()
    const connection = await driver.acquireConnection()
    await expect(connection.streamQuery({} as never).next()).rejects.toThrow(/streaming is not supported/)
  })
})
