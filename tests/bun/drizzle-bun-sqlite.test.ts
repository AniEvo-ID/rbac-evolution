import { describe, expect, it } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { createSqliteDb } from './helpers'

const { createRbac } = await import('@anievo-id/rbac-evolution')
const { runAdapterTests } = await import('@anievo-id/rbac-evolution/testing')
const { drizzleSqliteAdapter } = await import('@anievo-id/rbac-evolution-drizzle/sqlite')

// Bun's built-in SQLite driver (bun:sqlite) through drizzle-orm/bun-sqlite.
runAdapterTests('Drizzle + bun:sqlite', async () => drizzleSqliteAdapter(drizzle(await createSqliteDb())))

describe('Drizzle + bun:sqlite engine flow', () => {
  it('stores roles and permissions in a real bun:sqlite database', async () => {
    const sqlite = await createSqliteDb()
    const rbac = createRbac({ adapter: drizzleSqliteAdapter(drizzle(sqlite)) })

    await rbac.createPermission('edit articles')
    await rbac.createRole('writer')
    await rbac.role('writer').givePermissionTo('edit articles')
    await rbac.for({ type: 'user', id: 'u_1' }).assignRole('writer')

    expect(await rbac.for({ type: 'user', id: 'u_1' }).can('edit articles')).toBe(true)
    const row = sqlite.query('select count(*) as n from model_has_roles').get() as { n: number }
    expect(row.n).toBe(1)
  })
})
