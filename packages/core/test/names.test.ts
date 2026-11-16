/**
 * `isRoleName()` / `isPermissionName()`: type guards that check user input against the `names` lists of
 * `createRbac()`. Runtime behaviour, plus the narrowing (checked by `tsc --noEmit`, the `typecheck` script).
 */
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  createRbac,
  isPermissionName,
  isRoleName,
  MemoryAdapter,
  type PermissionName,
  type RbacNames,
  type RbacOptions,
  type RoleName,
} from '../src'

const roles = ['writer', 'editor', 'admin'] as const
const permissions = ['articles.edit', 'articles.publish'] as const
type AppRbac = { roles: (typeof roles)[number]; permissions: (typeof permissions)[number] }

const user = { type: 'user', id: 1 }

describe('isRoleName() / isPermissionName()', () => {
  const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter(), names: { roles, permissions } })

  it('accept exactly the listed names', () => {
    for (const name of roles) expect(isRoleName(rbac, name)).toBe(true)
    for (const name of permissions) expect(isPermissionName(rbac, name)).toBe(true)
    expect(isRoleName(rbac, 'articles.edit')).toBe(false)
    expect(isPermissionName(rbac, 'admin')).toBe(false)
  })

  it('reject anything else: unknown names, other cases, padding, pipes, wildcards and non-strings', () => {
    for (const value of ['ghost', 'Admin', ' admin', 'admin ', 'admin|writer', '', '*', undefined, null, 1, {}, ['admin']]) {
      expect(isRoleName(rbac, value)).toBe(false)
    }
    for (const value of ['articles.*', 'articles', 'articles.edit|articles.publish', 'ARTICLES.EDIT', 42]) {
      expect(isPermissionName(rbac, value)).toBe(false)
    }
  })

  it('check the list, not the database: a listed role that was never created still passes', async () => {
    expect(await rbac.findRole('editor')).toBeNull()
    expect(isRoleName(rbac, 'editor')).toBe(true)
  })

  it('make user input safe to pass on', async () => {
    await rbac.sync({ roles: { writer: ['articles.edit'], editor: ['articles.edit', 'articles.publish'], admin: '*' } })
    const body: unknown = { roles: ['editor', 'writer'] }
    const input = (body as { roles: unknown[] }).roles
    if (!input.every((name) => isRoleName(rbac, name))) throw new Error('unexpected')
    await rbac.for(user).syncRoles(input)
    expect((await rbac.for(user).getRoleNames()).sort()).toEqual(['editor', 'writer'])
  })

  it('throw a TypeError when the engine has no list for that kind', () => {
    const bare = createRbac({ adapter: new MemoryAdapter() })
    expect(() => isRoleName(bare, 'admin')).toThrow(TypeError)
    expect(() => isPermissionName(bare, 'x')).toThrow(/names: \{ permissions: \[\.\.\.\] \}/)
    const rolesOnly = createRbac<AppRbac>({ adapter: new MemoryAdapter(), names: { roles } })
    expect(isRoleName(rolesOnly, 'admin')).toBe(true)
    expect(() => isPermissionName(rolesOnly, 'articles.edit')).toThrow(/isPermissionName\(\) needs the list of names/)
  })

  it('validate the lists when the engine is created', () => {
    expect(() => createRbac({ adapter: new MemoryAdapter(), names: { roles: 'admin' as never } })).toThrow(TypeError)
    expect(() => createRbac({ adapter: new MemoryAdapter(), names: { permissions: [1] as never } })).toThrow(
      /`names.permissions` must be an array of strings/,
    )
    expect(() => createRbac({ adapter: new MemoryAdapter(), names: {} })).not.toThrow()
    expect(() => createRbac({ adapter: new MemoryAdapter(), names: undefined })).not.toThrow()
  })

  it('keep a copy: changing the array afterwards does not change the engine', () => {
    const list = ['a', 'b']
    const engine = createRbac({ adapter: new MemoryAdapter(), names: { roles: list } })
    list.push('c')
    expect(isRoleName(engine, 'c')).toBe(false)
  })

  it('work with string enums (Object.values)', () => {
    enum Role {
      Writer = 'writer',
      Admin = 'admin',
    }
    const engine = createRbac<{ roles: Role }>({ adapter: new MemoryAdapter(), names: { roles: Object.values(Role) } })
    expect(isRoleName(engine, 'admin')).toBe(true)
    expect(isRoleName(engine, Role.Writer)).toBe(true)
    expect(isRoleName(engine, 'Admin')).toBe(false)
  })
})

describe('isRoleName() / isPermissionName() types', () => {
  const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter(), names: { roles, permissions } })

  it('narrow unknown input to the names of the engine', () => {
    const input: unknown = 'admin'
    if (isRoleName(rbac, input)) expectTypeOf(input).toEqualTypeOf<RoleName<AppRbac>>()
    if (isPermissionName(rbac, input)) expectTypeOf(input).toEqualTypeOf<PermissionName<AppRbac>>()
    const list: unknown[] = []
    if (list.every((name) => isRoleName(rbac, name))) expectTypeOf(list).toEqualTypeOf<RoleName<AppRbac>[]>()
  })

  it('narrow to string on an untyped engine', () => {
    const untyped = createRbac({ adapter: new MemoryAdapter(), names: { roles: ['a'] } })
    const input: unknown = 'a'
    if (isRoleName(untyped, input)) expectTypeOf(input).toEqualTypeOf<string>()
  })

  it('type the `names` option with the names of the engine', () => {
    expectTypeOf<RbacOptions<AppRbac>['names']>().toEqualTypeOf<RbacNames<AppRbac> | undefined>()
    expectTypeOf<RbacNames<AppRbac>['roles']>().toEqualTypeOf<readonly RoleName<AppRbac>[] | undefined>()
    expectTypeOf<RbacNames['permissions']>().toEqualTypeOf<readonly string[] | undefined>()
    function invalid() {
      // @ts-expect-error -- not one of the typed roles
      createRbac<AppRbac>({ adapter: new MemoryAdapter(), names: { roles: ['writer', 'ghost'] } })
      // @ts-expect-error -- not one of the typed permissions
      createRbac<AppRbac>({ adapter: new MemoryAdapter(), names: { permissions: ['articles.delete'] } })
      // @ts-expect-error -- the engine comes first
      isRoleName('admin')
    }
    expectTypeOf(invalid).toBeFunction()
  })
})
