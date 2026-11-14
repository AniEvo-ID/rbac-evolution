import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import mongoose, { type Connection } from 'mongoose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongooseRbacAdapter, type RbacModels, createRbacModels, mongooseAdapter } from '../src'

const clear = (models: RbacModels): Promise<unknown> =>
  Promise.all(Object.values(models).map((model: mongoose.Model<unknown>) => model.deleteMany({})))

/**
 * Conformance suite + Mongo-specific checks. `uri` is resolved in `beforeAll`; collections get a
 * unique prefix so suites of other packages can share the database.
 */
export function runMongoSuite(name: string, uri: () => string | Promise<string>, cleanup?: () => Promise<void>): void {
  let conn: Connection
  let models: RbacModels
  const prefix = 'rbac_mongoose_test_'

  beforeAll(async () => {
    conn = await mongoose.createConnection(await uri()).asPromise()
    models = createRbacModels({ connection: conn, prefix })
    await Promise.all(Object.values(models).map((model: mongoose.Model<unknown>) => model.init()))
  }, 300_000) // the first mongodb-memory-server run downloads a mongod binary

  afterAll(async () => {
    if (conn !== undefined) {
      for (const model of Object.values(models) as mongoose.Model<unknown>[]) {
        await model.collection.drop().catch(() => undefined)
      }
      await conn.close()
    }
    await cleanup?.()
  }, 60_000)

  runAdapterTests(name, async () => {
    await clear(models)
    return new MongooseRbacAdapter(models)
  })

  describe(`${name}: specifics`, () => {
    it('uses prefixed collections and reuses registered models', async () => {
      await clear(models)
      const adapter = mongooseAdapter({ connection: conn, prefix })
      expect(adapter.models.Role).toBe(models.Role)
      expect(models.Permission.collection.collectionName).toBe(`${prefix}permissions`)
      expect(models.ModelHasRole.collection.collectionName).toBe(`${prefix}model_has_roles`)
    })

    it('returns ObjectId hex strings and ignores other ids', async () => {
      await clear(models)
      const adapter = new MongooseRbacAdapter(models)
      const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
      expect(p.id).toMatch(/^[0-9a-f]{24}$/)
      expect(await adapter.findPermissions({ ids: [1, 'nope', p.id] })).toHaveLength(1)
      await adapter.deletePermission('nope')
      await adapter.attachRolePermissions(1, [p.id])
      expect(await adapter.findPermissions()).toHaveLength(1)
    })

    it('enforces unique (name, guardName, teamId) on roles and (name, guardName) on permissions', async () => {
      await clear(models)
      const adapter = new MongooseRbacAdapter(models)
      await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
      await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 1 })
      await expect(adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })).rejects.toThrow()
      await adapter.createPermission({ name: 'edit', guardName: 'web' })
      await expect(adapter.createPermission({ name: 'edit', guardName: 'web' })).rejects.toThrow()
    })

    it('returns teamId as string for team roles and null for global roles', async () => {
      await clear(models)
      const adapter = new MongooseRbacAdapter(models)
      expect((await adapter.createRole({ name: 'a', guardName: 'web', teamId: 5 })).teamId).toBe('5')
      expect((await adapter.createRole({ name: 'a', guardName: 'web', teamId: null })).teamId).toBeNull()
      expect((await adapter.findRoles({ teamIds: [5] }))[0]?.teamId).toBe('5')
    })

    it('attaches idempotently under concurrency', async () => {
      await clear(models)
      const adapter = new MongooseRbacAdapter(models)
      const r = await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
      const alice = { type: 'user', id: 1 }
      await Promise.all(Array.from({ length: 8 }, () => adapter.attachSubjectRoles(alice, [r.id], null)))
      expect(await models.ModelHasRole.countDocuments()).toBe(1)
    })

    it('runs a full flow and fills timestamps', async () => {
      await clear(models)
      const rbac = createRbac({ adapter: new MongooseRbacAdapter(models), cache: false })
      await rbac.createPermission('edit')
      await rbac.createRole('writer')
      await rbac.role('writer').givePermissionTo('edit')
      await rbac.for({ type: 'user', id: 7 }).assignRole('writer')
      expect(await rbac.for({ type: 'user', id: 7 }).can('edit')).toBe(true)

      const role = await models.Role.findOne().lean()
      expect(role?.createdAt).toBeInstanceOf(Date)
      expect(role?.updatedAt).toBeInstanceOf(Date)
      expect(role?.teamId).toBe('')
    })
  })
}
