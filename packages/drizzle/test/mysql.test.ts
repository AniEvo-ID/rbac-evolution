// Runs only when MYSQL_URL points at a real MySQL 8 / MariaDB server (CI provides one); skipped otherwise.
import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { type MySql2Database, drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzleMysqlAdapter, mysqlRbacSchema } from '../src/mysql'
import { ddl, expiryDdl } from './ddl'
import { MYSQL_URL, TEST_DATABASE, skipNote, withDatabase } from './servers'

const TABLES = ['model_has_permissions', 'model_has_roles', 'role_has_permissions', 'roles', 'permissions']

describe.skipIf(MYSQL_URL === '')(`drizzle mysql (mysql2, real server)${skipNote('MYSQL_URL', MYSQL_URL)}`, () => {
  let pool: mysql.Pool
  let db: MySql2Database

  /** Deletes every row (children first; ids are not reset, tests never rely on them). */
  const clear = async (prefix = ''): Promise<void> => {
    for (const t of TABLES) await pool.query(`DELETE FROM \`${prefix}${t}\``)
  }

  const count = async (table: string): Promise<number> => {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(`SELECT count(*) AS n FROM \`${table}\``)
    return Number(rows[0]?.['n'])
  }

  beforeAll(async () => {
    const admin = await mysql.createConnection({ uri: MYSQL_URL, multipleStatements: true })
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DATABASE}\``)
    await admin.query(`USE \`${TEST_DATABASE}\``)
    // Recreate from the shipped DDL so every run starts from the current schema.
    for (const prefix of ['', 'rbac_', 'exp_']) {
      await admin.query(TABLES.map((t) => `DROP TABLE IF EXISTS \`${prefix}${t}\`;`).join('\n'))
      await admin.query(ddl('mysql', prefix))
    }
    // 1.1 tables upgraded with the shipped `sql/mysql-expiry.sql`.
    await admin.query(expiryDdl('mysql', 'exp_'))
    await admin.end()

    pool = mysql.createPool({ uri: withDatabase(MYSQL_URL, TEST_DATABASE), connectionLimit: 4 })
    db = drizzle({ client: pool })
  })

  afterAll(async () => {
    await pool?.end()
  })

  runAdapterTests('drizzle (MySQL via mysql2)', async () => {
    await clear()
    return drizzleMysqlAdapter(db)
  })

  runAdapterTests('drizzle (MySQL via mysql2, expiry)', async () => {
    await clear('exp_')
    return drizzleMysqlAdapter(db, mysqlRbacSchema({ prefix: 'exp_', expiry: true }), { expiry: true })
  })

  describe('drizzle mysql: specifics', () => {
    it('uses prefixed tables', async () => {
      await clear('rbac_')
      await clear()
      const adapter = drizzleMysqlAdapter(db, mysqlRbacSchema({ prefix: 'rbac_' }))
      const rbac = createRbac({ adapter, cache: false })
      await rbac.createPermission('edit')
      await rbac.createRole('writer')
      await rbac.role('writer').givePermissionTo('edit')
      await rbac.for({ type: 'user', id: 7 }).assignRole('writer')

      expect(await rbac.for({ type: 'user', id: 7 }).can('edit')).toBe(true)
      expect(await count('rbac_model_has_roles')).toBe(1)
      expect(await count('permissions')).toBe(0)
    })

    it('returns the generated ids from createPermission / createRole', async () => {
      await clear()
      const adapter = drizzleMysqlAdapter(db)
      const a = await adapter.createPermission({ name: 'a', guardName: 'web' })
      const b = await adapter.createPermission({ name: 'b', guardName: 'web' })
      const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: 3 })
      expect(typeof a.id).toBe('number')
      expect(b.id).toBeGreaterThan(Number(a.id))
      expect(r).toEqual({ id: r.id, name: 'r', guardName: 'web', teamId: '3' })
      expect(await adapter.findPermissions({ ids: [b.id] })).toEqual([b])
      expect(await adapter.findRoles({ ids: [r.id] })).toEqual([r])
    })

    it('enforces unique (name, guard_name, team_id) on roles', async () => {
      await clear()
      const adapter = drizzleMysqlAdapter(db)
      await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
      await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 1 })
      await expect(adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })).rejects.toThrow()
    })

    it('compares names and subject ids case-sensitively (binary collation)', async () => {
      await clear()
      const adapter = drizzleMysqlAdapter(db)
      await adapter.createPermission({ name: 'edit', guardName: 'web' })
      await adapter.createPermission({ name: 'Edit', guardName: 'web' })
      expect(await adapter.findPermissions({ names: ['edit'] })).toHaveLength(1)

      const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
      await adapter.attachSubjectRoles({ type: 'user', id: 'aBc' }, [r.id], null)
      expect(await adapter.getSubjectRoleIds({ type: 'user', id: 'ABC' }, null)).toEqual([])
      expect(await adapter.getSubjectRoleIds({ type: 'user', id: 'aBc' }, null)).toEqual([r.id])
    })

    it('still reports foreign-key errors on attach (no INSERT IGNORE)', async () => {
      await clear()
      const adapter = drizzleMysqlAdapter(db)
      const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
      await expect(adapter.attachRolePermissions(r.id, [999_999])).rejects.toThrow()
    })

    it('ignores non-integer ids instead of erroring', async () => {
      await clear()
      const adapter = drizzleMysqlAdapter(db)
      const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
      expect(await adapter.findPermissions({ ids: ['nope', String(p.id)] })).toHaveLength(1)
      await adapter.deletePermission('nope')
      expect(await adapter.findPermissions()).toHaveLength(1)
    })

    it('fills created_at / updated_at by default', async () => {
      await clear()
      const adapter = drizzleMysqlAdapter(db)
      await adapter.createPermission({ name: 'edit', guardName: 'web' })
      await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
      const { permissions, roles } = mysqlRbacSchema()
      for (const table of [permissions, roles]) {
        const [row] = await db.select({ c: table.createdAt, u: table.updatedAt }).from(table)
        expect(row?.c).toBeInstanceOf(Date)
        expect(row?.u).toBeInstanceOf(Date)
      }
    })
  })
})
