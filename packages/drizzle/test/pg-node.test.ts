// Runs only when PG_URL points at a real PostgreSQL server (CI provides one); skipped otherwise.
// The PGlite suite in pg.test.ts always runs.
import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzlePgAdapter, pgRbacSchema } from '../src/pg'
import { ddl } from './ddl'
import { PG_URL, TEST_DATABASE, skipNote, withDatabase } from './servers'

const TABLES = ['model_has_permissions', 'model_has_roles', 'role_has_permissions', 'roles', 'permissions']

describe.skipIf(PG_URL === '')(`drizzle pg (node-postgres, real server)${skipNote('PG_URL', PG_URL)}`, () => {
  let pool: pg.Pool
  let db: NodePgDatabase

  const truncate = async (prefix = ''): Promise<void> => {
    await pool.query(`TRUNCATE ${TABLES.map((t) => `"${prefix}${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
  }

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: PG_URL })
    await admin.connect()
    try {
      await admin.query(`CREATE DATABASE "${TEST_DATABASE}"`)
    } catch (error) {
      if ((error as { code?: string }).code !== '42P04') throw error // duplicate_database
    }
    await admin.end()

    pool = new pg.Pool({ connectionString: withDatabase(PG_URL, TEST_DATABASE), max: 4 })
    // Recreate from the shipped DDL so every run starts from the current schema.
    for (const prefix of ['', 'rbac_']) {
      await pool.query(TABLES.map((t) => `DROP TABLE IF EXISTS "${prefix}${t}" CASCADE;`).join('\n'))
      await pool.query(ddl('pg', prefix))
    }
    db = drizzle({ client: pool })
  })

  afterAll(async () => {
    await pool?.end()
  })

  runAdapterTests('drizzle (PostgreSQL via node-postgres)', async () => {
    await truncate()
    return drizzlePgAdapter(db)
  })

  describe('drizzle pg (node-postgres): specifics', () => {
    it('uses prefixed tables', async () => {
      await truncate('rbac_')
      await truncate()
      const adapter = drizzlePgAdapter(db, pgRbacSchema({ prefix: 'rbac_' }))
      const rbac = createRbac({ adapter, cache: false })
      await rbac.createPermission('edit')
      await rbac.createRole('writer')
      await rbac.role('writer').givePermissionTo('edit')
      await rbac.for({ type: 'user', id: 7 }).assignRole('writer')

      expect(await rbac.for({ type: 'user', id: 7 }).can('edit')).toBe(true)
      const rows = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM "rbac_model_has_roles"')
      expect(rows.rows[0]?.n).toBe(1)
    })

    it('enforces unique (name, guard_name, team_id) on roles', async () => {
      await truncate()
      const adapter = drizzlePgAdapter(db)
      await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
      await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 1 })
      await expect(adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })).rejects.toThrow()
    })

    it('fills created_at / updated_at by default', async () => {
      await truncate()
      const adapter = drizzlePgAdapter(db)
      await adapter.createPermission({ name: 'edit', guardName: 'web' })
      await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
      const { permissions, roles } = pgRbacSchema()
      for (const table of [permissions, roles]) {
        const [row] = await db.select({ c: table.createdAt, u: table.updatedAt }).from(table)
        expect(row?.c).toBeInstanceOf(Date)
        expect(row?.u).toBeInstanceOf(Date)
      }
    })
  })
})
