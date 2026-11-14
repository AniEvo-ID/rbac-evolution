/**
 * Typed names (spatie "Enums"). Most assertions here are type-level: the
 * `@ts-expect-error` lines are verified by `tsc --noEmit` (the `typecheck` script).
 */
import { describe, expect, it } from 'vitest'
import {
  createRbac,
  MemoryAdapter,
  type PermissionName,
  type Rbac,
  type RoleName,
  type RoleRbac,
  type SubjectRbac,
} from '../src'

type AppTypes = { permissions: 'edit articles' | 'delete articles'; roles: 'writer' | 'admin' }

enum Perm {
  Edit = 'edit',
  Delete = 'delete',
}
enum RoleEnum {
  Writer = 'writer',
}

const alice = { type: 'user', id: 1 }

type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false
const assertType = <T extends true>(_value?: T): void => {}

describe('typed names', () => {
  it('works at runtime with string literal unions', async () => {
    const rbac = createRbac<AppTypes>({ adapter: new MemoryAdapter(), superAdminRoles: ['admin'] })
    await rbac.createPermission('edit articles')
    await rbac.createPermission('delete articles')
    await rbac.createRole('writer')
    await rbac.createRole('admin')
    await rbac.role('writer').givePermissionTo('edit articles')

    const user = rbac.for(alice)
    await user.assignRole('writer')
    expect(await user.can('edit articles')).toBe(true)
    expect(await user.hasRole(['writer', 'admin'])).toBe(true)
    expect(await user.hasExactRoles('writer')).toBe(true)
    expect(await rbac.subjectsWithPermission('user', 'edit articles')).toEqual([1])
  })

  it('works at runtime with string enums', async () => {
    const rbac = createRbac<{ permissions: Perm; roles: RoleEnum }>({ adapter: new MemoryAdapter() })
    await rbac.createPermission(Perm.Edit)
    await rbac.createPermission('delete') // enum literal values are accepted too
    await rbac.createRole(RoleEnum.Writer)
    await rbac.role(RoleEnum.Writer).givePermissionTo(Perm.Edit, Perm.Delete)
    await rbac.for(alice).assignRole(RoleEnum.Writer)
    expect(await rbac.for(alice).canAll(Perm.Edit, 'delete')).toBe(true)
  })

  it('rejects unknown names at compile time', () => {
    // Never executed — only type-checked.
    const typeOnly = async (rbac: Rbac<AppTypes>): Promise<void> => {
      const user = rbac.for(alice)
      // @ts-expect-error unknown permission
      await rbac.createPermission('fly')
      // @ts-expect-error unknown role
      await rbac.createRole('ghost')
      // @ts-expect-error unknown role
      rbac.role('ghost')
      // @ts-expect-error unknown permission
      await rbac.role('writer').givePermissionTo('fly')
      // @ts-expect-error unknown permission
      await user.can('fly')
      // @ts-expect-error unknown permission (array form)
      await user.canAny(['edit articles', 'fly'])
      // @ts-expect-error unknown permission
      await user.givePermissionTo('fly')
      // @ts-expect-error unknown permission
      await user.hasPermissionTo('fly')
      // @ts-expect-error unknown role
      await user.assignRole('ghost')
      // @ts-expect-error unknown role
      await user.hasRole('ghost')
      // @ts-expect-error unknown role
      await user.hasExactRoles('ghost')
      // @ts-expect-error unknown role
      await rbac.subjectsWithRole('user', 'ghost')
      // @ts-expect-error unknown permission
      await rbac.subjectsWithPermission('user', 'fly')
      // @ts-expect-error unknown role
      createRbac<AppTypes>({ adapter: new MemoryAdapter(), superAdminRoles: ['ghost'] })

      // Objects are always accepted.
      const permission = await rbac.findPermissionOrFail('edit articles')
      await user.can(permission)
    }

    const enumOnly = async (rbac: Rbac<{ permissions: Perm }>): Promise<void> => {
      await rbac.for(alice).can(Perm.Edit)
      await rbac.for(alice).can('edit')
      // @ts-expect-error not an enum value
      await rbac.for(alice).can('fly')
      // roles are not configured → any string
      await rbac.for(alice).assignRole('anything')
    }

    expect(typeof typeOnly).toBe('function')
    expect(typeof enumOnly).toBe('function')
  })

  it('keeps untyped usage and default type params backward compatible', () => {
    assertType<Equal<PermissionName, string>>()
    assertType<Equal<RoleName, string>>()
    assertType<Equal<PermissionName<AppTypes>, 'edit articles' | 'delete articles'>>()
    assertType<Equal<PermissionName<{ roles: 'x' }>, string>>()
    assertType<Equal<RoleName<{ roles: RoleEnum }>, RoleEnum | 'writer'>>()

    const untyped: Rbac = createRbac({ adapter: new MemoryAdapter() })
    const typed = createRbac<AppTypes>({ adapter: new MemoryAdapter() })

    // A typed instance can be passed where the default `Rbac` is expected (framework packages).
    const asDefault: Rbac = typed
    const subject: SubjectRbac = typed.for(alice)
    const role: RoleRbac = typed.role('writer')
    const fromDefault: SubjectRbac = untyped.for(alice)

    expect([asDefault, subject, role, fromDefault]).toHaveLength(4)
  })
})
