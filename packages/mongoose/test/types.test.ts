/**
 * Type tests for the public API of the Mongoose adapter. Most assertions are type-level: they (and the
 * `@ts-expect-error` lines) are checked by `tsc --noEmit` (the `typecheck` script). No database is opened:
 * models are registered on a connection that is never opened, and no query is run.
 */
import { createRbac, type Rbac, type RbacAdapter } from '@anievo-id/rbac-evolution'
import mongoose, { type Connection, type HydratedDocument, type Model, type Schema, type Types } from 'mongoose'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  type ModelHasPermissionDoc,
  type ModelHasRoleDoc,
  MongooseRbacAdapter,
  type PermissionDoc,
  type RbacCollectionNames,
  type RbacModelOptions,
  type RbacModels,
  type RoleDoc,
  type RoleHasPermissionDoc,
  collectionNames,
  createRbacModels,
  mongooseAdapter,
  rbacSchemas,
  syncRbacIndexes,
} from '../src'

describe('mongoose: types', () => {
  it('mongooseAdapter / MongooseRbacAdapter are RbacAdapters usable with createRbac', () => {
    const conn = mongoose.createConnection() // never opened
    const adapter = mongooseAdapter({ connection: conn, prefix: 'rbac_types_' })
    expect(adapter).toBeInstanceOf(MongooseRbacAdapter)
    expectTypeOf(adapter).toEqualTypeOf<MongooseRbacAdapter>()
    expectTypeOf(adapter).toMatchTypeOf<RbacAdapter>()
    expectTypeOf(adapter.models).toEqualTypeOf<RbacModels>()

    const rbac = createRbac({ adapter, cache: false })
    expectTypeOf(rbac).toEqualTypeOf<Rbac>()
    const typed = createRbac<{ permissions: 'edit'; roles: 'writer' }>({ adapter: new MongooseRbacAdapter(adapter.models) })
    expectTypeOf(typed.for({ type: 'user', id: 'u1' }).hasRole).toBeCallableWith('writer')

    expectTypeOf(MongooseRbacAdapter).constructorParameters.toEqualTypeOf<[models: RbacModels]>()
    expectTypeOf(mongooseAdapter).parameters.toEqualTypeOf<[options?: RbacModelOptions]>()
  })

  it('RbacModelOptions: connection + prefix, exactOptionalPropertyTypes', () => {
    expectTypeOf<RbacModelOptions>().toEqualTypeOf<{ connection?: Connection; prefix?: string }>()
    expectTypeOf(createRbacModels).parameters.toEqualTypeOf<[options?: RbacModelOptions]>()
    expectTypeOf(mongooseAdapter).toBeCallableWith()
    expectTypeOf(mongooseAdapter).toBeCallableWith({ prefix: 'rbac_' })
    expectTypeOf(createRbacModels).toBeCallableWith({ connection: mongoose.connection })

    // Never called: only type-checked.
    const _bad = () => {
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      mongooseAdapter({ connection: undefined })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      createRbacModels({ prefix: undefined })
      // @ts-expect-error a URI is not a Connection
      mongooseAdapter({ connection: 'mongodb://localhost/test' })
      // @ts-expect-error collection names are not configurable, only the prefix
      mongooseAdapter({ collections: { roles: 'my_roles' } })
    }
    expect(typeof _bad).toBe('function')
  })

  it('collectionNames only takes the prefix', () => {
    const names = collectionNames({ prefix: 'rbac_' })
    expect(names.modelHasRoles).toBe('rbac_model_has_roles')
    expectTypeOf(names).toEqualTypeOf<RbacCollectionNames>()
    expectTypeOf(collectionNames).parameters.toEqualTypeOf<[options?: Pick<RbacModelOptions, 'prefix'>]>()
    expectTypeOf<keyof RbacCollectionNames>().toEqualTypeOf<
      'permissions' | 'roles' | 'roleHasPermissions' | 'modelHasRoles' | 'modelHasPermissions'
    >()
    // `createRbacModels` options (with a connection) are accepted too
    expectTypeOf(collectionNames).toBeCallableWith({ connection: mongoose.connection, prefix: 'x_' } as RbacModelOptions)
  })

  it('models and documents are typed', () => {
    const models = createRbacModels({ connection: mongoose.createConnection(), prefix: 'rbac_types_models_' })
    expect(models.Role.collection.collectionName).toBe('rbac_types_models_roles')

    expectTypeOf(models).toEqualTypeOf<RbacModels>()
    expectTypeOf(models.Permission).toEqualTypeOf<Model<PermissionDoc>>()
    expectTypeOf(models.Role).toEqualTypeOf<Model<RoleDoc>>()
    expectTypeOf(models.RoleHasPermission).toEqualTypeOf<Model<RoleHasPermissionDoc>>()
    expectTypeOf(models.ModelHasRole).toEqualTypeOf<Model<ModelHasRoleDoc>>()
    expectTypeOf(models.ModelHasPermission).toEqualTypeOf<Model<ModelHasPermissionDoc>>()

    expectTypeOf<PermissionDoc>().toEqualTypeOf<{
      _id: Types.ObjectId
      name: string
      guardName: string
      createdAt: Date
      updatedAt: Date
    }>()
    expectTypeOf<RoleDoc['teamId']>().toEqualTypeOf<string>()
    expectTypeOf<ModelHasRoleDoc>().toEqualTypeOf<{
      _id: Types.ObjectId
      roleId: Types.ObjectId
      subjectType: string
      subjectId: string
      teamId: string
    }>()
    expectTypeOf<ModelHasPermissionDoc['permissionId']>().toEqualTypeOf<Types.ObjectId>()
    expectTypeOf<RoleHasPermissionDoc>().toHaveProperty('roleId').toEqualTypeOf<Types.ObjectId>()

    // queries return hydrated rbac documents
    const _query = async () => {
      const role = await models.Role.findOne({ name: 'writer' })
      expectTypeOf(role).toEqualTypeOf<HydratedDocument<RoleDoc> | null>()
      // @ts-expect-error not a field of RoleDoc
      role?.permissions
    }
    expect(typeof _query).toBe('function')

    expectTypeOf(syncRbacIndexes).parameters.toEqualTypeOf<[models: RbacModels]>()
    expectTypeOf(syncRbacIndexes).returns.toEqualTypeOf<Promise<void>>()
  })

  it('rbacSchemas returns the five typed schemas', () => {
    const schemas = rbacSchemas()
    expect(Object.keys(schemas).sort()).toEqual([
      'modelHasPermission',
      'modelHasRole',
      'permission',
      'role',
      'roleHasPermission',
    ])
    expectTypeOf(schemas.permission).toMatchTypeOf<Schema<PermissionDoc>>()
    expectTypeOf(schemas.role).toMatchTypeOf<Schema<RoleDoc>>()
    expectTypeOf(schemas.roleHasPermission).toMatchTypeOf<Schema<RoleHasPermissionDoc>>()
    expectTypeOf(schemas.modelHasRole).toMatchTypeOf<Schema<ModelHasRoleDoc>>()
    expectTypeOf(schemas.modelHasPermission).toMatchTypeOf<Schema<ModelHasPermissionDoc>>()
  })

  it('MongooseRbacAdapter rejects incomplete model sets', () => {
    const _bad = (models: RbacModels) => {
      const { Role: _role, ...withoutRole } = models
      // @ts-expect-error `Role` is missing
      new MongooseRbacAdapter(withoutRole)
      // @ts-expect-error swapped models: a Model<PermissionDoc> is not a Model<RoleDoc>
      new MongooseRbacAdapter({ ...models, Role: models.Permission })
    }
    expect(typeof _bad).toBe('function')
  })
})
