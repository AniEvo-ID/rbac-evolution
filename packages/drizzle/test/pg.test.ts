import { PGlite } from '@electric-sql/pglite'
import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { drizzle } from 'drizzle-orm/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzlePgAdapter, pgRbacSchema } from '../src/pg'
import { ddl } from './ddl'

const client = new PGlite()
const db = drizzle(client)

const truncate = (prefix = ''): Promise<unknown> =>
  client.exec(
    `TRUNCATE ${['model_has_permissions', 'model_has_roles', 'role_has_permissions', 'roles', 'permissions']
      .map((t) => `"${prefix}${t}"`)
      .join(', ')} RESTART IDENTITY CASCADE`,
  )

beforeAll(async () => {
  await client.exec(ddl('pg'))
  await client.exec(ddl('pg', 'rbac_'))
})

afterAll(async () => {
  await client.close()
})

runAdapterTests('drizzle (PostgreSQL via PGlite)', async () => {
  await truncate()
  return drizzlePgAdapter(db)
})

describe('drizzle pg: specifics', () => {
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
    const rows = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM "rbac_model_has_roles"')
    expect(rows.rows[0]?.n).toBe(1)
    const unprefixed = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM "permissions"')
    expect(unprefixed.rows[0]?.n).toBe(0)
  })

  it('enforces unique (name, guard_name, team_id) on roles', async () => {
    await truncate()
    const adapter = drizzlePgAdapter(db)
    await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
    await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 1 })
    await expect(adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })).rejects.toThrow()
  })

  it('ignores non-integer ids instead of erroring', async () => {
    await truncate()
    const adapter = drizzlePgAdapter(db)
    const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
    expect(typeof p.id).toBe('number')
    expect(await adapter.findPermissions({ ids: ['nope', String(p.id)] })).toHaveLength(1)
    await adapter.deletePermission('nope')
    expect(await adapter.findPermissions()).toHaveLength(1)
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
      expect(Math.abs((row?.c.getTime() ?? 0) - Date.now())).toBeLessThan(60_000)
    }
  })
})
