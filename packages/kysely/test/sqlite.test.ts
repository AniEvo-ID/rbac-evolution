import { LibsqlDialect } from '@libsql/kysely-libsql'
import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { Kysely, sql } from 'kysely'
import { describe, expect, it } from 'vitest'
import { type RbacDatabase, createRbacTables, kyselyAdapter, rbacExpiryMigration, rbacMigration } from '../src'
import { loadMigrator } from './migrator'
import { count } from './shared'

/** Fresh in-memory database per call. */
async function freshDb(
  options: { prefix?: string; foreignKeys?: boolean; tables?: boolean; expiry?: boolean } = {},
) {
  const db = new Kysely<RbacDatabase>({ dialect: new LibsqlDialect({ url: ':memory:' }) })
  await sql`PRAGMA foreign_keys = ${sql.raw(options.foreignKeys === true ? 'ON' : 'OFF')}`.execute(db)
  if (options.tables !== false) {
    await createRbacTables(db, { prefix: options.prefix ?? '', expiry: options.expiry === true })
  }
  return db
}

// Foreign keys OFF: proves the adapter removes links itself rather than relying on ON DELETE CASCADE.
runAdapterTests('kysely (SQLite via libsql, foreign_keys=OFF)', async () => kyselyAdapter(await freshDb()))

runAdapterTests('kysely (SQLite via libsql, foreign_keys=ON)', async () =>
  kyselyAdapter(await freshDb({ foreignKeys: true })),
)

runAdapterTests('kysely (SQLite via libsql, expiry)', async () =>
  kyselyAdapter(await freshDb({ expiry: true }), { expiry: true }),
)

describe('kysely sqlite: specifics', () => {
  it('detects the sqlite dialect', async () => {
    expect(kyselyAdapter(await freshDb()).dialect).toBe('sqlite')
  })

  it('uses prefixed tables', async () => {
    const db = await freshDb({ prefix: 'rbac_' })
    const rbac = createRbac({ adapter: kyselyAdapter(db, { prefix: 'rbac_' }), cache: false })
    await rbac.createPermission('edit')
    await rbac.createRole('writer')
    await rbac.role('writer').givePermissionTo('edit')
    await rbac.for({ type: 'user', id: 7 }).assignRole('writer')

    expect(await rbac.for({ type: 'user', id: 7 }).can('edit')).toBe(true)
    expect(await count(db, 'rbac_model_has_roles')).toBe(1)
    const tables = (await db.introspection.getTables()).map((t) => t.name)
    expect(tables).not.toContain('permissions')
  })

  it('createRbacTables skips existing tables', async () => {
    const db = await freshDb()
    await createRbacTables(db)
    expect((await db.introspection.getTables()).map((t) => t.name).sort()).toEqual([
      'model_has_permissions',
      'model_has_roles',
      'permissions',
      'role_has_permissions',
      'roles',
    ])
  })

  it('enforces unique (name, guard_name) on permissions', async () => {
    const adapter = kyselyAdapter(await freshDb())
    await adapter.createPermission({ name: 'edit', guardName: 'web' })
    await adapter.createPermission({ name: 'edit', guardName: 'api' })
    await expect(adapter.createPermission({ name: 'edit', guardName: 'web' })).rejects.toThrow()
  })

  it('returns teamId as string for team roles and null for global roles', async () => {
    const adapter = kyselyAdapter(await freshDb())
    expect((await adapter.createRole({ name: 'a', guardName: 'web', teamId: 5 })).teamId).toBe('5')
    expect((await adapter.createRole({ name: 'a', guardName: 'web', teamId: null })).teamId).toBeNull()
    expect((await adapter.findRoles({ teamIds: [5] }))[0]?.teamId).toBe('5')
  })

  it('cascades link deletes through foreign keys when enabled', async () => {
    const db = await freshDb({ foreignKeys: true })
    const adapter = kyselyAdapter(db)
    const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
    await adapter.attachSubjectPermissions({ type: 'user', id: 1 }, [p.id], null)
    await db.deleteFrom('permissions').execute()
    expect(await count(db, 'model_has_permissions')).toBe(0)
  })

  it('fills created_at / updated_at (unix seconds) by default', async () => {
    const db = await freshDb()
    const adapter = kyselyAdapter(db)
    await adapter.createPermission({ name: 'edit', guardName: 'web' })
    await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
    for (const table of ['permissions', 'roles'] as const) {
      const row = await db.selectFrom(table).select(['created_at', 'updated_at']).executeTakeFirstOrThrow()
      expect(Math.abs(Number(row.created_at) * 1000 - Date.now())).toBeLessThan(60_000)
      expect(Math.abs(Number(row.updated_at) * 1000 - Date.now())).toBeLessThan(60_000)
    }
  })

  it('works as a Kysely Migration (up / down)', async () => {
    const db = await freshDb({ tables: false })
    const Migrator = await loadMigrator()
    const migrator = new Migrator({
      db,
      provider: { getMigrations: async () => ({ '0001_rbac': rbacMigration({ prefix: 'acl_' }) }) },
    })
    const up = await migrator.migrateToLatest()
    expect(up.error).toBeUndefined()
    expect((await db.introspection.getTables()).map((t) => t.name)).toContain('acl_roles')

    const down = await migrator.migrateDown()
    expect(down.error).toBeUndefined()
    expect((await db.introspection.getTables()).map((t) => t.name)).not.toContain('acl_roles')
  })

  it('upgrades a 1.1 database with rbacExpiryMigration (up / down), storing unix ms', async () => {
    const db = await freshDb({ tables: false })
    const migrations = { '0001_rbac': rbacMigration(), '0002_rbac_expiry': rbacExpiryMigration() }
    const Migrator = await loadMigrator()
    const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } })
    expect((await migrator.migrateToLatest()).error).toBeUndefined()

    const adapter = kyselyAdapter(db, { expiry: true })
    const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
    await adapter.attachSubjectRoles({ type: 'user', id: 1 }, [r.id], null, { expiresAt: new Date(1_900_000_000_123) })
    const row = await db.selectFrom('model_has_roles').selectAll().executeTakeFirstOrThrow()
    expect((row as unknown as { expires_at: number }).expires_at).toBe(1_900_000_000_123)

    expect((await migrator.migrateDown()).error).toBeUndefined()
    const columns = (await db.introspection.getTables()).find((t) => t.name === 'model_has_roles')!.columns
    expect(columns.map((c) => c.name)).not.toContain('expires_at')
    // The 1.1 adapter (no expiry) still works on the downgraded table.
    expect(await kyselyAdapter(db).getSubjectRoleIds({ type: 'user', id: 1 }, null)).toEqual([r.id])
  })

  it('accepts an explicit dialect', async () => {
    const adapter = kyselyAdapter(await freshDb(), { dialect: 'sqlite' })
    expect((await adapter.createPermission({ name: 'x', guardName: 'web' })).id).toBe(1)
  })
})
