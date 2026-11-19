import 'reflect-metadata'
import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { tableNames } from '@anievo-id/rbac-evolution-kysely'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type RbacDialect } from '@anievo-id/rbac-evolution-kysely'
import { dialectOf, rbacMigration, typeormAdapter } from '../src'

/** Deletes every row (links first). */
export async function clearTables(ds: DataSource, prefix: string): Promise<void> {
  const n = tableNames({ prefix })
  for (const table of [n.modelHasPermissions, n.modelHasRoles, n.roleHasPermissions, n.roles, n.permissions]) {
    await ds.createQueryBuilder().delete().from(table).execute()
  }
}

/**
 * Conformance suite + TypeORM specifics against a real server through a DataSource. Tables get a unique prefix
 * (`migrations` of the DataSource must hold `rbacMigration({ prefix, expiry: true })`) so suites of other packages
 * can share the database.
 */
export function runDataSourceSuite(name: string, dialect: RbacDialect, connect: () => DataSource, prefix: string): void {
  let ds: DataSource

  beforeAll(async () => {
    ds = connect()
    await ds.initialize()
    // Leftovers of an interrupted run: this suite's own migrations table, so nothing else is reverted.
    while ((await executed(ds)) > 0) await ds.undoLastMigration()
    await ds.runMigrations()
  })

  afterAll(async () => {
    if (ds?.isInitialized !== true) return
    await ds.undoLastMigration()
    const runner = ds.createQueryRunner()
    await runner.dropTable(`${prefix}migrations`, true)
    await runner.release()
    await ds.destroy()
  })

  runAdapterTests(name, async () => {
    await clearTables(ds, prefix)
    return typeormAdapter(ds, { prefix })
  })

  runAdapterTests(`${name}, expiry`, async () => {
    await clearTables(ds, prefix)
    return typeormAdapter(ds, { prefix, expiry: true })
  })

  describe(`${name}: specifics`, () => {
    it('detects the dialect', () => {
      expect(dialectOf(ds)).toBe(dialect)
    })

    it('joins the transaction of an EntityManager: a rollback undoes the rbac writes', async () => {
      await clearTables(ds, prefix)
      const rbac = createRbac({ adapter: typeormAdapter(ds, { prefix }), cache: false })
      await rbac.createRole('writer')
      await expect(
        ds.transaction(async (manager) => {
          const tx = createRbac({ adapter: typeormAdapter(manager, { prefix }), cache: false })
          await tx.for({ type: 'user', id: 1 }).assignRole('writer')
          expect(await tx.for({ type: 'user', id: 1 }).hasRole('writer')).toBe(true)
          throw new Error('rollback')
        }),
      ).rejects.toThrow('rollback')
      expect(await rbac.for({ type: 'user', id: 1 }).hasRole('writer')).toBe(false)
    })

    it('commits with the transaction', async () => {
      await clearTables(ds, prefix)
      const rbac = createRbac({ adapter: typeormAdapter(ds, { prefix }), cache: false })
      await rbac.createRole('writer')
      await ds.transaction(async (manager) => {
        await createRbac({ adapter: typeormAdapter(manager, { prefix }), cache: false })
          .for({ type: 'user', id: 2 })
          .assignRole('writer')
      })
      expect(await rbac.for({ type: 'user', id: 2 }).hasRole('writer')).toBe(true)
    })

    it('works with dataSource.manager (no query runner)', async () => {
      await clearTables(ds, prefix)
      const adapter = typeormAdapter(ds.manager, { prefix })
      await adapter.createPermission({ name: 'edit', guardName: 'web' })
      expect((await adapter.findPermissions()).map((p) => p.name)).toEqual(['edit'])
    })
  })
}

/** Rows in the DataSource's migrations table. */
async function executed(ds: DataSource): Promise<number> {
  const runner = ds.createQueryRunner()
  try {
    return (await runner.hasTable(ds.options.migrationsTableName ?? 'migrations'))
      ? (await ds.createQueryBuilder().select('1').from(ds.options.migrationsTableName ?? 'migrations', 'm').getRawMany()).length
      : 0
  } finally {
    await runner.release()
  }
}

/** DataSource options a real-server suite needs: the rbac migration, in a migrations table of its own. */
export const suiteOptions = (prefix: string) => ({
  migrations: [rbacMigration({ prefix, expiry: true })],
  migrationsTableName: `${prefix}migrations`,
})
