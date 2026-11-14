import { createClient } from '@libsql/client'
import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { drizzle } from 'drizzle-orm/libsql'
import { describe, expect, it } from 'vitest'
import { drizzleSqliteAdapter, sqliteRbacSchema } from '../src/sqlite'
import { ddl } from './ddl'

/** Fresh in-memory database per call. */
async function freshDb(prefix = '', foreignKeys = false) {
  const client = createClient({ url: ':memory:' })
  await client.execute(`PRAGMA foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`)
  await client.executeMultiple(ddl('sqlite', prefix))
  return { client, db: drizzle(client) }
}

// Foreign keys OFF: proves the adapter removes links itself rather than relying on ON DELETE CASCADE.
runAdapterTests('drizzle (SQLite via libsql, foreign_keys=OFF)', async () => {
  const { db } = await freshDb()
  return drizzleSqliteAdapter(db)
})

runAdapterTests('drizzle (SQLite via libsql, foreign_keys=ON)', async () => {
  const { db } = await freshDb('', true)
  return drizzleSqliteAdapter(db)
})

describe('drizzle sqlite: specifics', () => {
  it('uses prefixed tables', async () => {
    const { client, db } = await freshDb('rbac_')
    const adapter = drizzleSqliteAdapter(db, sqliteRbacSchema({ prefix: 'rbac_' }))
    const rbac = createRbac({ adapter, cache: false })
    await rbac.createPermission('edit')
    await rbac.createRole('writer')
    await rbac.role('writer').givePermissionTo('edit')
    await rbac.for({ type: 'user', id: 7 }).assignRole('writer')

    expect(await rbac.for({ type: 'user', id: 7 }).can('edit')).toBe(true)
    const rows = await client.execute('SELECT count(*) AS n FROM "rbac_model_has_roles"')
    expect(Number(rows.rows[0]?.n)).toBe(1)
  })

  it('enforces unique (name, guard_name) on permissions', async () => {
    const { db } = await freshDb()
    const adapter = drizzleSqliteAdapter(db)
    await adapter.createPermission({ name: 'edit', guardName: 'web' })
    await adapter.createPermission({ name: 'edit', guardName: 'api' })
    await expect(adapter.createPermission({ name: 'edit', guardName: 'web' })).rejects.toThrow()
  })

  it('returns teamId as string for team roles and null for global roles', async () => {
    const { db } = await freshDb()
    const adapter = drizzleSqliteAdapter(db)
    expect((await adapter.createRole({ name: 'a', guardName: 'web', teamId: 5 })).teamId).toBe('5')
    expect((await adapter.createRole({ name: 'a', guardName: 'web', teamId: null })).teamId).toBeNull()
  })
  it('fills created_at / updated_at by default', async () => {
    const { db } = await freshDb()
    const adapter = drizzleSqliteAdapter(db)
    await adapter.createPermission({ name: 'edit', guardName: 'web' })
    await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
    const { permissions, roles } = sqliteRbacSchema()
    for (const table of [permissions, roles]) {
      const [row] = await db.select({ c: table.createdAt, u: table.updatedAt }).from(table)
      expect(row?.c).toBeInstanceOf(Date)
      expect(row?.u).toBeInstanceOf(Date)
      expect(Math.abs((row?.c.getTime() ?? 0) - Date.now())).toBeLessThan(60_000)
    }
  })
})
