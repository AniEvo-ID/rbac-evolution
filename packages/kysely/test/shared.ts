import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { type Kysely, sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type RbacDialect, createRbacTables, dropRbacTables, kyselyAdapter, tableNames } from '../src'

/** Deletes every row (links first). Portable across dialects, unlike TRUNCATE. */
export async function clearTables(db: Kysely<any>, prefix = ''): Promise<void> {
  const n = tableNames({ prefix })
  for (const table of [n.modelHasPermissions, n.modelHasRoles, n.roleHasPermissions, n.roles, n.permissions]) {
    await db.deleteFrom(table).execute()
  }
}

export const count = async (db: Kysely<any>, table: string): Promise<number> => {
  const row = await db
    .selectFrom(table)
    .select(sql<number | string | bigint>`count(*)`.as('n'))
    .executeTakeFirst()
  return Number(row?.n ?? 0)
}

/**
 * Conformance suite + dialect-specific checks against a shared, long-lived database
 * (tables get a unique prefix so suites of other packages can use the same database).
 */
export function runSharedDatabaseSuite(
  name: string,
  dialect: RbacDialect,
  connect: () => Kysely<any>,
  prefix: string,
): void {
  let db: Kysely<any>

  beforeAll(async () => {
    db = connect()
    await dropRbacTables(db, { prefix })
    await createRbacTables(db, { prefix })
  })

  afterAll(async () => {
    if (db === undefined) return
    await dropRbacTables(db, { prefix })
    await db.destroy()
  })

  runAdapterTests(name, async () => {
    await clearTables(db, prefix)
    return kyselyAdapter(db, { prefix })
  })

  describe(`${name}: specifics`, () => {
    it('detects the dialect', () => {
      expect(kyselyAdapter(db, { prefix }).dialect).toBe(dialect)
    })

    it('createRbacTables is idempotent', async () => {
      await createRbacTables(db, { prefix })
    })

    it('enforces unique (name, guard_name, team_id) on roles, case-sensitively', async () => {
      await clearTables(db, prefix)
      const adapter = kyselyAdapter(db, { prefix })
      await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
      await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 1 })
      await adapter.createRole({ name: 'Admin', guardName: 'web', teamId: null })
      await expect(adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })).rejects.toThrow()
      expect(await adapter.findRoles({ names: ['admin'], teamIds: [null] })).toHaveLength(1)
    })

    it('enforces unique (name, guard_name) on permissions', async () => {
      await clearTables(db, prefix)
      const adapter = kyselyAdapter(db, { prefix })
      await adapter.createPermission({ name: 'edit', guardName: 'web' })
      await adapter.createPermission({ name: 'edit', guardName: 'api' })
      await expect(adapter.createPermission({ name: 'edit', guardName: 'web' })).rejects.toThrow()
    })

    it('returns integer ids and ignores non-integer ids', async () => {
      await clearTables(db, prefix)
      const adapter = kyselyAdapter(db, { prefix })
      const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
      expect(typeof p.id).toBe('number')
      expect(await adapter.findPermissions({ ids: ['nope', String(p.id)] })).toHaveLength(1)
      await adapter.deletePermission('nope')
      expect(await adapter.findPermissions()).toHaveLength(1)
    })

    it('runs a full flow and fills timestamps', async () => {
      await clearTables(db, prefix)
      const rbac = createRbac({ adapter: kyselyAdapter(db, { prefix }), cache: false })
      await rbac.createPermission('edit')
      await rbac.createRole('writer')
      await rbac.role('writer').givePermissionTo('edit')
      await rbac.for({ type: 'user', id: 7 }).assignRole('writer')
      await rbac.for({ type: 'user', id: 7 }).assignRole('writer')
      expect(await rbac.for({ type: 'user', id: 7 }).can('edit')).toBe(true)

      const n = tableNames({ prefix })
      expect(await count(db, n.modelHasRoles)).toBe(1)
      for (const table of [n.permissions, n.roles]) {
        const row = await db.selectFrom(table).select(['created_at', 'updated_at']).executeTakeFirstOrThrow()
        expect(row.created_at).not.toBeNull()
        expect(row.updated_at).not.toBeNull()
      }
    })
  })
}
