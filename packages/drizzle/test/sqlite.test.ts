import { createClient } from '@libsql/client'
import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { drizzle } from 'drizzle-orm/libsql'
import { describe, expect, it } from 'vitest'
import { drizzleSqliteAdapter, sqliteRbacSchema } from '../src/sqlite'
import { ddl } from './ddl'

/** Fresh in-memory database per call. */
async function freshDb(prefix = '', foreignKeys = false, expiry = false) {
  const client = createClient({ url: ':memory:' })
  await client.execute(`PRAGMA foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`)
  await client.executeMultiple(ddl('sqlite', prefix, { expiry }))
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

runAdapterTests('drizzle (SQLite via libsql, expiry)', async () => {
  const { db } = await freshDb('', false, true)
  return drizzleSqliteAdapter(db, sqliteRbacSchema({ expiry: true }), { expiry: true })
})

describe('drizzle sqlite: expiry', () => {
  it('needs the expiry schema for { expiry: true }', async () => {
    const { db } = await freshDb()
    expect(() => drizzleSqliteAdapter(db, sqliteRbacSchema(), { expiry: true })).toThrow(/expiresAt/)
  })

  it('stores unix ms, and without { expiry: true } never touches the column', async () => {
    const { client, db } = await freshDb('', false, true)
    const adapter = drizzleSqliteAdapter(db, sqliteRbacSchema({ expiry: true }), { expiry: true })
    const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
    await adapter.attachSubjectRoles({ type: 'user', id: 1 }, [r.id], null, { expiresAt: new Date(1_900_000_000_123) })
    const rows = await client.execute('SELECT expires_at FROM model_has_roles')
    expect(Number(rows.rows[0]?.['expires_at'])).toBe(1_900_000_000_123)

    // The 1.1 schema object on the upgraded table: reads and writes as before, the column stays NULL.
    const plain = drizzleSqliteAdapter(db)
    await plain.attachSubjectRoles({ type: 'user', id: 2 }, [r.id], null)
    expect(await plain.getSubjectRoleIds({ type: 'user', id: 1 }, null)).toEqual([r.id])
    const second = await client.execute("SELECT expires_at FROM model_has_roles WHERE subject_id = '2'")
    expect(second.rows[0]?.['expires_at']).toBeNull()
  })

  it('on a 1.1 database, the default adapter refuses an expiresAt instead of granting permanent access', async () => {
    const { db } = await freshDb()
    const rbac = createRbac({ adapter: drizzleSqliteAdapter(db), cache: false })
    await rbac.createRole('on-call')
    await expect(
      rbac.for({ type: 'user', id: 1 }).assignRole('on-call', { expiresAt: new Date(Date.now() + 60_000) }),
    ).rejects.toMatchObject({ code: 'EXPIRY_NOT_SUPPORTED' })
    expect(await rbac.for({ type: 'user', id: 1 }).getRoleNames()).toEqual([])
  })
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
