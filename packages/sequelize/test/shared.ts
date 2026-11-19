import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { type RbacDialect, tableNames } from '@anievo-id/rbac-evolution-kysely'
import type { Sequelize } from 'sequelize'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dialectOf, rbacMigration, sequelizeAdapter } from '../src'

/** Deletes every row (links first). */
export async function clearTables(sequelize: Sequelize, prefix: string): Promise<void> {
  const n = tableNames({ prefix })
  const q = sequelize.getQueryInterface()
  for (const table of [n.modelHasPermissions, n.modelHasRoles, n.roleHasPermissions, n.roles, n.permissions]) {
    await q.bulkDelete(table, {})
  }
}

/**
 * Conformance suite + Sequelize specifics against a real server. Tables get a unique prefix so suites of other
 * packages can share the database.
 */
export function runSequelizeSuite(name: string, dialect: RbacDialect, connect: () => Sequelize, prefix: string): void {
  let sequelize: Sequelize
  const migration = rbacMigration({ prefix, expiry: true })

  beforeAll(async () => {
    sequelize = connect()
    await migration.down(sequelize.getQueryInterface())
    await migration.up(sequelize.getQueryInterface())
  })

  afterAll(async () => {
    if (sequelize === undefined) return
    await migration.down({ context: sequelize })
    await sequelize.close()
  })

  runAdapterTests(name, async () => {
    await clearTables(sequelize, prefix)
    return sequelizeAdapter(sequelize, { prefix })
  })

  runAdapterTests(`${name}, expiry`, async () => {
    await clearTables(sequelize, prefix)
    return sequelizeAdapter(sequelize, { prefix, expiry: true })
  })

  describe(`${name}: specifics`, () => {
    it('detects the dialect', () => {
      expect(dialectOf(sequelize)).toBe(dialect)
    })

    it('joins a managed transaction: a rollback undoes the rbac writes', async () => {
      await clearTables(sequelize, prefix)
      const rbac = createRbac({ adapter: sequelizeAdapter(sequelize, { prefix }), cache: false })
      await rbac.createRole('writer')
      await expect(
        sequelize.transaction(async (t) => {
          const tx = createRbac({ adapter: sequelizeAdapter(t, { prefix }), cache: false })
          await tx.for({ type: 'user', id: 1 }).assignRole('writer')
          expect(await tx.for({ type: 'user', id: 1 }).hasRole('writer')).toBe(true)
          throw new Error('rollback')
        }),
      ).rejects.toThrow('rollback')
      expect(await rbac.for({ type: 'user', id: 1 }).hasRole('writer')).toBe(false)
    })

    it('commits with the transaction', async () => {
      await clearTables(sequelize, prefix)
      const rbac = createRbac({ adapter: sequelizeAdapter(sequelize, { prefix }), cache: false })
      await rbac.createRole('writer')
      await sequelize.transaction(async (t) => {
        await createRbac({ adapter: sequelizeAdapter(t, { prefix }), cache: false })
          .for({ type: 'user', id: 2 })
          .assignRole('writer')
      })
      expect(await rbac.for({ type: 'user', id: 2 }).hasRole('writer')).toBe(true)
    })

    it('counts the rows pruneExpired() deletes', async () => {
      await clearTables(sequelize, prefix)
      const adapter = sequelizeAdapter(sequelize, { prefix, expiry: true })
      const rbac = createRbac({ adapter, cache: false })
      await rbac.createRole('writer')
      await rbac.for({ type: 'user', id: 3 }).assignRole('writer', { expiresAt: new Date(Date.now() + 1_000) })
      const later = createRbac({ adapter, cache: false, now: () => new Date(Date.now() + 60_000) })
      expect(await later.pruneExpired()).toEqual({ roles: 1, permissions: 0 })
    })
  })
}
