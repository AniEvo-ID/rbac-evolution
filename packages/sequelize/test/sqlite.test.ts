import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { Sequelize } from 'sequelize'
import { describe, expect, it } from 'vitest'
import { rbacExpiryMigration, rbacMigration, sequelizeAdapter, sequelizeDialect, toBindSql } from '../src'
import { runSequelizeSuite } from './shared'

/** Fresh in-memory database per call, with the tables created by the migration. */
async function fresh(options: { prefix?: string; expiry?: boolean } = {}) {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
  await rbacMigration(options).up(sequelize.getQueryInterface())
  return sequelize
}

const tables = async (sequelize: Sequelize): Promise<string[]> =>
  ((await sequelize.getQueryInterface().showAllTables()) as string[]).sort()

runAdapterTests('sequelize (SQLite via sqlite3)', async () => sequelizeAdapter(await fresh()))

runAdapterTests('sequelize (SQLite via sqlite3, expiry)', async () =>
  sequelizeAdapter(await fresh({ expiry: true }), { expiry: true }),
)

describe('sequelize (SQLite, one database)', () => {
  runSequelizeSuite(
    'sequelize (SQLite via sqlite3, one database)',
    'sqlite',
    () => new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }),
    'seq_test_',
  )
})

describe('sequelize sqlite: specifics', () => {
  it('rbacMigration creates the five tables, and its down() drops them', async () => {
    const sequelize = await fresh()
    expect(await tables(sequelize)).toEqual([
      'model_has_permissions',
      'model_has_roles',
      'permissions',
      'role_has_permissions',
      'roles',
    ])
    await rbacMigration().down({ context: sequelize.getQueryInterface() })
    expect(await tables(sequelize)).toEqual([])
  })

  it('rbacExpiryMigration adds and removes the expires_at columns', async () => {
    const sequelize = await fresh()
    const columns = async () => Object.keys(await sequelize.getQueryInterface().describeTable('model_has_roles'))
    await rbacExpiryMigration().up({ context: sequelize })
    expect(await columns()).toContain('expires_at')
    const rbac = createRbac({ adapter: sequelizeAdapter(sequelize, { expiry: true }), cache: false })
    await rbac.createRole('writer')
    await rbac.for({ type: 'user', id: 1 }).assignRole('writer', { expiresAt: new Date(Date.now() + 60_000) })
    expect(await rbac.for({ type: 'user', id: 1 }).hasRole('writer')).toBe(true)
    await rbacExpiryMigration().down(sequelize)
    expect(await columns()).not.toContain('expires_at')
  })

  it('uses prefixed tables', async () => {
    const sequelize = await fresh({ prefix: 'rbac_' })
    const rbac = createRbac({ adapter: sequelizeAdapter(sequelize, { prefix: 'rbac_' }), cache: false })
    await rbac.createPermission('edit')
    await rbac.createRole('writer')
    await rbac.role('writer').givePermissionTo('edit')
    await rbac.for({ type: 'user', id: 7 }).assignRole('writer')
    expect(await rbac.for({ type: 'user', id: 7 }).can('edit')).toBe(true)
    expect(await tables(sequelize)).toContain('rbac_model_has_roles')
  })

  it('rejects a dialect it does not support, and something that is not Sequelize', () => {
    const db2 = { getDialect: () => 'db2', query: async () => [], transaction: async () => ({}) as never }
    expect(() => sequelizeAdapter(db2)).toThrow(/"db2" dialect is not supported/)
    expect(() => sequelizeAdapter({} as never)).toThrow(/expected a Sequelize instance or transaction/)
  })
})

/** A Sequelize stand-in that records its queries and answers with `result`. */
function fake(dialect: string, result: unknown) {
  const calls: { sql: string; options: Record<string, unknown> }[] = []
  const log: string[] = []
  const sequelize = {
    getDialect: () => dialect,
    query: async (sql: string, options: Record<string, unknown>) => {
      calls.push({ sql, options })
      if (result instanceof Error) throw result
      return result
    },
    transaction: async () => {
      log.push('begin')
      return {
        sequelize,
        commit: async () => void log.push('commit'),
        rollback: async () => void log.push('rollback'),
      }
    },
  }
  return { sequelize, calls, log }
}

describe('sequelize dialect', () => {
  it('rewrites placeholders as Sequelize bind parameters', () => {
    expect(toBindSql('select * from t where a = $1 and b = $2', 'postgres')).toBe('select * from t where a = $1 and b = $2')
    expect(toBindSql('select * from t where a = ? and b in (?, ?)', 'mysql')).toBe(
      'select * from t where a = $1 and b in ($2, $3)',
    )
    expect(toBindSql('select * from t where a = @1 and b = @12', 'mssql')).toBe('select * from t where a = $1 and b = $12')
  })

  it('reads the MySQL insert id from an INSERT query', async () => {
    const f = fake('mariadb', [42, 1])
    const permission = await sequelizeAdapter(f.sequelize).createPermission({ name: 'edit', guardName: 'web' })
    expect(permission.id).toBe(42)
    expect(f.calls[0]?.options.type).toBe('INSERT')
    expect(f.calls[0]?.sql).toMatch(/values \(\$1, \$2\)/)
  })

  it('runs SQL Server statements with $n bind parameters, and reads OUTPUT rows as a select', async () => {
    const f = fake('mssql', [{ id: 5 }])
    expect((await sequelizeAdapter(f.sequelize).createRole({ name: 'a', guardName: 'web', teamId: null })).id).toBe(5)
    expect(f.calls[0]?.options.type).toBe('SELECT')
    expect(f.calls[0]?.sql).not.toMatch(/@\d/)
  })

  it('starts, commits and rolls back its own transactions', async () => {
    const ok = fake('postgres', 0)
    await sequelizeAdapter(ok.sequelize).deleteRole(1)
    expect(ok.log).toEqual(['begin', 'commit'])
    expect(ok.calls.every((c) => c.options.transaction !== undefined)).toBe(true)

    const failing = fake('postgres', new Error('boom'))
    await expect(sequelizeAdapter(failing.sequelize).deleteRole(1)).rejects.toThrow('boom')
    expect(failing.log).toEqual(['begin', 'rollback'])
  })

  it('never commits the transaction of the caller', async () => {
    const f = fake('postgres', 0)
    const t = await f.sequelize.transaction()
    await sequelizeAdapter(t).deleteRole(1)
    expect(f.log).toEqual(['begin'])
    expect(f.calls.every((c) => c.options.transaction === t)).toBe(true)
  })

  it('does not stream', async () => {
    const driver = sequelizeDialect(fake('postgres', []).sequelize).createDriver()
    const connection = await driver.acquireConnection()
    await expect(connection.streamQuery({} as never).next()).rejects.toThrow(/streaming is not supported/)
  })
})
