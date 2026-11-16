/**
 * Typed names per guard (`RbacTypeConfig['guards']`). Most assertions are type-level: the `@ts-expect-error`
 * lines and `expectTypeOf()` calls are verified by `tsc --noEmit` (the `typecheck` script). Calls that are only
 * meant to be type-checked live in functions that are never executed.
 */
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  type BeforeContext,
  type CheckGuard,
  createRbac,
  type DefaultGuardName,
  type GuardName,
  type GuardOptions,
  isPermissionName,
  isRoleName,
  MemoryAdapter,
  type PermissionName,
  Rbac,
  type RbacNames,
  type RbacOptions,
  type RbacTypeConfig,
  type RoleName,
  type RoleRbac,
  type ScopedGuardName,
  type ScopeOptions,
  type SubjectRbac,
  type SyncDefinitions,
  type SyncDefinition,
  type SyncOptions,
  type TeamId,
} from '../src'

type AppRbac = {
  guards: {
    web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
    api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
  }
  defaultGuard: 'web'
}
type WebPermission = 'articles.edit' | 'api-keys.manage'
type ApiPermission = 'orders.read' | 'orders.write'
type WebRole = 'admin' | 'editor'
type ApiRole = 'read-only' | 'full-access'

/** `defaultGuard` left out: `web`, like the runtime default. */
type ImplicitWeb = { guards: { web: { roles: 'admin' }; api: { roles: 'client' } } }
/** Another default guard, and a guard that only types its roles. */
type ApiFirst = {
  guards: { api: { permissions: 'orders.read' }; web: { roles: 'admin' } }
  defaultGuard: 'api'
}

const user = { type: 'user', id: 1 }
const key = { type: 'api-key', id: 'k_1' }

describe('typed names per guard', () => {
  describe('name types', () => {
    it('resolve the names of each guard', () => {
      expectTypeOf<GuardName<AppRbac>>().toEqualTypeOf<'web' | 'api'>()
      expectTypeOf<DefaultGuardName<AppRbac>>().toEqualTypeOf<'web'>()
      expectTypeOf<DefaultGuardName<ImplicitWeb>>().toEqualTypeOf<'web'>()
      expectTypeOf<DefaultGuardName<ApiFirst>>().toEqualTypeOf<'api'>()

      expectTypeOf<PermissionName<AppRbac>>().toEqualTypeOf<WebPermission>()
      expectTypeOf<PermissionName<AppRbac, 'web'>>().toEqualTypeOf<WebPermission>()
      expectTypeOf<PermissionName<AppRbac, 'api'>>().toEqualTypeOf<ApiPermission>()
      expectTypeOf<RoleName<AppRbac>>().toEqualTypeOf<WebRole>()
      expectTypeOf<RoleName<AppRbac, 'api'>>().toEqualTypeOf<ApiRole>()
      // A non-literal guard: the names of every guard.
      expectTypeOf<PermissionName<AppRbac, string>>().toEqualTypeOf<WebPermission | ApiPermission>()
      expectTypeOf<RoleName<AppRbac, string>>().toEqualTypeOf<WebRole | ApiRole>()
      expectTypeOf<RoleName<AppRbac, 'web' | 'api'>>().toEqualTypeOf<WebRole | ApiRole>()

      // A guard that leaves a key out accepts any string there, as in a flat config.
      expectTypeOf<PermissionName<ApiFirst>>().toEqualTypeOf<'orders.read'>()
      expectTypeOf<RoleName<ApiFirst>>().toEqualTypeOf<string>()
      expectTypeOf<PermissionName<ApiFirst, 'web'>>().toEqualTypeOf<string>()
      expectTypeOf<RoleName<ApiFirst, string>>().toEqualTypeOf<string>()
    })

    it('check a guard option: typed guards, or any string as a fallback', () => {
      expectTypeOf<CheckGuard<AppRbac, 'api'>>().toEqualTypeOf<'api'>()
      expectTypeOf<CheckGuard<AppRbac, string>>().toEqualTypeOf<string>()
      expectTypeOf<CheckGuard<AppRbac, 'apii'>>().toEqualTypeOf<'web' | 'api'>()
      expectTypeOf<ScopedGuardName<AppRbac, 'api'>>().toEqualTypeOf<'api'>()
    })
  })

  describe('the engine', () => {
    it('narrows names by the guard in use', () => {
      const typeOnly = async (rbac: Rbac<AppRbac>, input: string): Promise<void> => {
        expectTypeOf(rbac.for(user)).toEqualTypeOf<SubjectRbac<AppRbac, 'web'>>()
        expectTypeOf(rbac.for(user)).toEqualTypeOf<SubjectRbac<AppRbac>>()
        expectTypeOf(rbac.for(key, { guard: 'api' })).toEqualTypeOf<SubjectRbac<AppRbac, 'api'>>()
        expectTypeOf(rbac.for(key, { guard: 'api', team: null })).toEqualTypeOf<SubjectRbac<AppRbac, 'api'>>()
        expectTypeOf(rbac.for(user).withScope({ guard: 'api' })).toEqualTypeOf<SubjectRbac<AppRbac, 'api'>>()
        expectTypeOf(rbac.for(key, { guard: 'api' }).withScope({})).toEqualTypeOf<SubjectRbac<AppRbac, 'api'>>()
        expectTypeOf(rbac.role('read-only', { guard: 'api' })).toEqualTypeOf<RoleRbac<AppRbac, 'api'>>()
        expectTypeOf(rbac.role('admin')).toEqualTypeOf<RoleRbac<AppRbac, 'web'>>()

        await rbac.for(user).can('articles.edit')
        await rbac.for(user).assignRole('admin', 'editor')
        await rbac.for(key, { guard: 'api' }).can('orders.read')
        await rbac.for(key, { guard: 'api' }).assignRole('read-only')
        await rbac.for(key, { guard: 'api' }).givePermissionTo(['orders.read', 'orders.write'])
        await rbac.for(user).withScope({ guard: 'api' }).hasRole('full-access')
        await rbac.role('read-only', { guard: 'api' }).givePermissionTo('orders.read')
        await rbac.role('admin').givePermissionTo('api-keys.manage')

        await rbac.createPermission('articles.edit')
        await rbac.createPermission('orders.read', { guard: 'api' })
        await rbac.createRole('read-only', { guard: 'api' })
        await rbac.findRole('full-access', { guard: 'api' })
        await rbac.findRoleOrFail('admin')
        await rbac.findOrCreateRole('read-only', { guard: 'api', actor: 'seed' })
        await rbac.findPermission('orders.write', { guard: 'api' })
        await rbac.findPermissionOrFail('api-keys.manage')
        await rbac.findOrCreatePermission('orders.read', { guard: 'api' })
        await rbac.deletePermission('orders.read', { guard: 'api' })
        await rbac.deleteRole('read-only', { guard: 'api' })
        await rbac.rolesWithPermission('orders.read', { guard: 'api' })
        await rbac.subjectsWithRole('api-key', ['read-only', 'full-access'], { guard: 'api' })
        await rbac.subjectsWithPermission('api-key', 'orders.read', { guard: 'api', expandWildcards: true })

        // A non-literal guard: any guard's names.
        await rbac.for(key, { guard: input }).can('orders.read')
        await rbac.for(key, { guard: input }).can('articles.edit')
        await rbac.createRole('read-only', { guard: input })

        // @ts-expect-error -- `api-keys.manage` is a `web` permission
        await rbac.for(key, { guard: 'api' }).can('api-keys.manage')
        // @ts-expect-error -- `orders.read` is an `api` permission; `for(user)` uses the default guard
        await rbac.for(user).can('orders.read')
        // @ts-expect-error -- `admin` is a `web` role
        await rbac.for(user).withScope({ guard: 'api' }).assignRole('admin')
        // @ts-expect-error -- `read-only` is an `api` role
        await rbac.createRole('read-only')
        // @ts-expect-error -- `admin` is a `web` role
        await rbac.createRole('admin', { guard: 'api' })
        // @ts-expect-error -- `articles.edit` is a `web` permission
        await rbac.createPermission('articles.edit', { guard: 'api' })
        // @ts-expect-error -- `articles.edit` is a `web` permission
        await rbac.role('read-only', { guard: 'api' }).givePermissionTo('articles.edit')
        // @ts-expect-error -- `admin` is a `web` role
        await rbac.subjectsWithRole('api-key', 'admin', { guard: 'api' })
        // @ts-expect-error -- not a typed guard
        rbac.for(key, { guard: 'apii' })
        // @ts-expect-error -- not a typed guard
        await rbac.createRole('read-only', { guard: 'mobile' })
        // @ts-expect-error -- not a name of any guard
        await rbac.for(key, { guard: input }).can('orders.delete')
      }
      expectTypeOf(typeOnly).toBeFunction()
    })

    it('types the engine options with the guards', () => {
      expectTypeOf<RbacOptions<AppRbac>['defaultGuard']>().toEqualTypeOf<'web' | undefined>()
      expectTypeOf<RbacOptions<ApiFirst>['defaultGuard']>().toEqualTypeOf<'api' | undefined>()
      expectTypeOf<RbacOptions<AppRbac>['superAdminRoles']>().toEqualTypeOf<readonly (WebRole | ApiRole)[] | undefined>()
      expectTypeOf<BeforeContext<AppRbac>['subject']>().toEqualTypeOf<SubjectRbac<AppRbac, string>>()

      const typeOnly = (): void => {
        createRbac<ApiFirst>({ adapter: new MemoryAdapter(), defaultGuard: 'api' })
        createRbac<AppRbac>({ adapter: new MemoryAdapter(), superAdminRoles: ['admin', 'full-access'] })
        // @ts-expect-error -- the typed default guard is `api`
        createRbac<ApiFirst>({ adapter: new MemoryAdapter(), defaultGuard: 'web' })
        // @ts-expect-error -- not a role of any guard
        createRbac<AppRbac>({ adapter: new MemoryAdapter(), superAdminRoles: ['root'] })
      }
      expectTypeOf(typeOnly).toBeFunction()
    })

    it('a typed engine is an Rbac<RbacTypeConfig>, and a scoped subject a subject of any guard', () => {
      const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
      // Like a flat config with only some keys, a per-guard config is not a `DefaultRbacTypes`: generic code
      // takes `Rbac<T>` (as the integrations do) or `Rbac<RbacTypeConfig>`.
      const generic: Rbac<RbacTypeConfig> = rbac
      const anyGuard: SubjectRbac<AppRbac, string> = rbac.for(key, { guard: 'api' })
      const webRole: RoleRbac<AppRbac, string> = rbac.role('admin')
      expect([generic, anyGuard, webRole]).toHaveLength(3)
    })
  })

  describe('sync()', () => {
    it('checks each block against its own guard', () => {
      const typeOnly = async (rbac: Rbac<AppRbac>): Promise<void> => {
        await rbac.sync({ permissions: ['articles.edit'], roles: { admin: '*', editor: ['articles.edit'] } })
        await rbac.sync([
          { permissions: ['articles.edit', 'api-keys.manage'], roles: { admin: '*' } },
          { guard: 'web', roles: { editor: ['articles.edit'] } },
          { guard: 'api', permissions: ['orders.read', 'orders.write'], roles: { 'read-only': ['orders.read'] } },
        ])
        await rbac.sync({ roles: { 'full-access': '*' } }, { guard: 'api' })

        // @ts-expect-error -- `orders.read` is an `api` permission
        await rbac.sync({ guard: 'web', permissions: ['orders.read'] })
        // @ts-expect-error -- `admin` is a `web` role
        await rbac.sync({ guard: 'api', roles: { admin: '*' } })
        // @ts-expect-error -- blocks without `guard` take the `guard` option's names
        await rbac.sync({ roles: { admin: '*' } }, { guard: 'api' })
        // @ts-expect-error -- not a typed guard
        await rbac.sync({ guard: 'mobile', roles: {} })
      }
      expectTypeOf(typeOnly).toBeFunction()
      expectTypeOf<SyncDefinitions<{ roles: 'a' }>>().toEqualTypeOf<
        SyncDefinition<{ roles: 'a' }> | readonly SyncDefinition<{ roles: 'a' }>[]
      >()
    })

    it('seeds every guard at runtime', async () => {
      const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
      await rbac.sync([
        { permissions: ['articles.edit', 'api-keys.manage'], roles: { admin: '*' } },
        { guard: 'api', permissions: ['orders.read', 'orders.write'], roles: { 'read-only': ['orders.read'] } },
      ])
      await rbac.for(key, { guard: 'api' }).assignRole('read-only')
      expect(await rbac.for(key, { guard: 'api' }).can('orders.read')).toBe(true)
      expect(await rbac.for(key, { guard: 'api' }).can('orders.write')).toBe(false)
      expect((await rbac.getPermissions({ guard: 'api' })).map((p) => p.name).sort()).toEqual([
        'orders.read',
        'orders.write',
      ])
    })
  })

  describe('isRoleName() / isPermissionName()', () => {
    const rbac = createRbac<AppRbac>({
      adapter: new MemoryAdapter(),
      names: {
        guards: {
          web: { roles: ['admin', 'editor'], permissions: ['articles.edit', 'api-keys.manage'] },
          api: { roles: ['read-only', 'full-access'], permissions: ['orders.read', 'orders.write'] },
        },
      },
    })

    it('check the list of the given guard (the default guard without one)', () => {
      expect(isRoleName(rbac, 'admin')).toBe(true)
      expect(isRoleName(rbac, 'read-only')).toBe(false)
      expect(isRoleName(rbac, 'read-only', { guard: 'api' })).toBe(true)
      expect(isRoleName(rbac, 'admin', { guard: 'api' })).toBe(false)
      expect(isPermissionName(rbac, 'api-keys.manage', { guard: 'web' })).toBe(true)
      expect(isPermissionName(rbac, 'api-keys.manage', { guard: 'api' })).toBe(false)
      expect(isPermissionName(rbac, 'orders.read', { guard: 'api' })).toBe(true)
    })

    it('fall back to the top-level lists, then throw', () => {
      const mixed = createRbac({
        adapter: new MemoryAdapter(),
        names: { roles: ['admin'], guards: { api: { roles: ['client'] } } },
      })
      expect(isRoleName(mixed, 'admin')).toBe(true)
      expect(isRoleName(mixed, 'client', { guard: 'api' })).toBe(true)
      expect(isRoleName(mixed, 'admin', { guard: 'api' })).toBe(false)
      expect(isRoleName(mixed, 'admin', { guard: 'admin-panel' })).toBe(true)
      expect(() => isPermissionName(mixed, 'x', { guard: 'api' })).toThrow(
        /isPermissionName\(\) needs the list of names of guard `api`/,
      )
      expect(() =>
        createRbac({ adapter: new MemoryAdapter(), names: { guards: { api: { roles: 'client' as never } } } }),
      ).toThrow(/`names.guards.api.roles` must be an array of strings/)
      expect(() => createRbac({ adapter: new MemoryAdapter(), names: { guards: [] as never } })).toThrow(TypeError)
    })

    it('narrow to the names of the guard', () => {
      const input: unknown = 'admin'
      if (isRoleName(rbac, input)) expectTypeOf(input).toEqualTypeOf<RoleName<AppRbac>>()
      if (isRoleName(rbac, input, { guard: 'api' })) expectTypeOf(input).toEqualTypeOf<RoleName<AppRbac, 'api'>>()
      if (isPermissionName(rbac, input, { guard: 'api' })) expectTypeOf(input).toEqualTypeOf<ApiPermission>()
      const guard: string = 'api'
      if (isRoleName(rbac, input, { guard })) expectTypeOf(input).toEqualTypeOf<WebRole | ApiRole>()

      expectTypeOf<NonNullable<RbacNames<AppRbac>['guards']>['api']>().toEqualTypeOf<
        import('../src').RbacGuardNames<AppRbac, 'api'> | undefined
      >()
      const typeOnly = (): void => {
        // @ts-expect-error -- not a typed guard
        isRoleName(rbac, input, { guard: 'apii' })
        createRbac<AppRbac>({
          adapter: new MemoryAdapter(),
          // @ts-expect-error -- `admin` is a `web` role
          names: { guards: { api: { roles: ['admin'] } } },
        })
      }
      expectTypeOf(typeOnly).toBeFunction()
    })
  })
})

describe('1.1 configs keep their meaning', () => {
  type Flat = { permissions: 'edit articles' | 'delete articles'; roles: 'writer' | 'admin' }

  it('flat configs ignore the guard, as before', () => {
    expectTypeOf<GuardName<Flat>>().toEqualTypeOf<string>()
    expectTypeOf<DefaultGuardName<Flat>>().toEqualTypeOf<string>()
    expectTypeOf<PermissionName<Flat, 'api'>>().toEqualTypeOf<PermissionName<Flat>>()
    expectTypeOf<RoleName<Flat, 'anything'>>().toEqualTypeOf<'writer' | 'admin'>()
    expectTypeOf<PermissionName>().toEqualTypeOf<string>()
    expectTypeOf<CheckGuard<Flat, 'api'>>().toEqualTypeOf<'api'>()
    expectTypeOf<ScopedGuardName<Flat, 'api'>>().toEqualTypeOf<string>()

    const typeOnly = async (rbac: Rbac<Flat>, untyped: Rbac, input: string): Promise<void> => {
      // `guard` is still any string, and the names stay the engine's.
      expectTypeOf(rbac.for(user, { guard: 'api' })).toEqualTypeOf<SubjectRbac<Flat>>()
      expectTypeOf(rbac.for(user, { guard: input }).withScope({ guard: 'x' })).toEqualTypeOf<SubjectRbac<Flat>>()
      expectTypeOf(rbac.role('writer', { guard: 'api' })).toEqualTypeOf<RoleRbac<Flat>>()
      expectTypeOf(untyped.for(user, { guard: 'api' })).toEqualTypeOf<SubjectRbac>()
      await rbac.createRole('writer', { guard: 'api' })
      await rbac.sync({ guard: 'api', roles: { writer: ['edit articles'] } }, { guard: input })
      // @ts-expect-error -- still checked
      await rbac.for(user, { guard: 'api' }).can('edit artcles')
      // @ts-expect-error -- `guard` is still a string
      rbac.for(user, { guard: 1 })
    }
    expectTypeOf(typeOnly).toBeFunction()
  })

  it('the 1.1 option and definition types are unchanged and still assignable', () => {
    expectTypeOf<GuardOptions>().toEqualTypeOf<{ guard?: string | undefined }>()
    expectTypeOf<ScopeOptions>().toEqualTypeOf<{ guard?: string | undefined; team?: TeamId | undefined }>()
    expectTypeOf<SyncOptions['guard']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<SyncDefinition<Flat>['guard']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<SyncDefinitions<Flat>>().toEqualTypeOf<SyncDefinition<Flat> | readonly SyncDefinition<Flat>[]>()
    expectTypeOf<RbacOptions<Flat>['defaultGuard']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<RbacOptions<Flat>['superAdminRoles']>().toEqualTypeOf<readonly ('writer' | 'admin')[] | undefined>()
    expectTypeOf<BeforeContext<Flat>['subject']>().toEqualTypeOf<SubjectRbac<Flat>>()
    expectTypeOf<RbacNames<Flat>['roles']>().toEqualTypeOf<readonly RoleName<Flat>[] | undefined>()

    // Typed values still fit the untyped types (framework packages, wrappers).
    const rbac = createRbac<Flat>({ adapter: new MemoryAdapter() })
    const asDefault: Rbac = rbac
    const subject: SubjectRbac = rbac.for(user, { guard: 'api' })
    const role: RoleRbac = rbac.role('writer')
    const options: RbacOptions = {} as RbacOptions<Flat>
    const definition: SyncDefinition = {} as SyncDefinition<Flat>
    const names: RbacNames = {} as RbacNames<Flat>
    const context: BeforeContext = {} as BeforeContext<Flat>
    expect([asDefault, subject, role, options, definition, names, context]).toHaveLength(7)
  })
})
