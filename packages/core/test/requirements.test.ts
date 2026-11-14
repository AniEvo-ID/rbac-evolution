import { describe, expect, it } from 'vitest'
import {
  createRbac,
  MemoryAdapter,
  permissionRequirement,
  roleOrPermissionRequirement,
  roleRequirement,
  satisfiesRequirement,
  splitRequirementArgs,
} from '../src'

describe('requirement parsing', () => {
  it('permissions: arguments are all required, pipes mean any, { any } = any of everything', () => {
    expect(permissionRequirement(['a', 'b|c']).requirements).toEqual([['a'], ['b', 'c']])
    expect(permissionRequirement([['a', 'b']]).requirements).toEqual([['a'], ['b']])
    expect(permissionRequirement(['a', 'b|c'], { any: true }).requirements).toEqual([['a', 'b', 'c']])
  })

  it('roles: any by default, { all } = each role required; role or permission = any', () => {
    expect(roleRequirement(['a|b', 'c']).requirements).toEqual([['a', 'b', 'c']])
    expect(roleRequirement(['a|b'], { all: true }).requirements).toEqual([['a'], ['b']])
    expect(roleOrPermissionRequirement(['admin|edit']).requirements).toEqual([['admin', 'edit']])
  })

  it('throws without names (blank entries are dropped)', () => {
    expect(() => permissionRequirement([])).toThrow(TypeError)
    expect(() => permissionRequirement([' | '])).toThrow(TypeError)
    expect(() => roleRequirement([' | '])).toThrow(TypeError)
    expect(() => roleRequirement([], { all: true })).toThrow(TypeError)
    expect(() => roleOrPermissionRequirement([''])).toThrow(TypeError)
  })

  it('splits a trailing options object from the names', () => {
    expect(splitRequirementArgs(['a', ['b'], { any: true }])).toEqual({ names: ['a', ['b']], options: { any: true } })
    expect(splitRequirementArgs(['a', ['b']])).toEqual({ names: ['a', ['b']], options: undefined })
  })
})

describe('satisfiesRequirement', () => {
  it('checks every group against the subject', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), cache: false })
    await rbac.createPermission('edit')
    await rbac.createPermission('publish')
    await rbac.createRole('writer')
    await rbac.role('writer').givePermissionTo('edit')
    const user = rbac.for({ type: 'user', id: 1 })
    await user.assignRole('writer')

    expect(await satisfiesRequirement(user, permissionRequirement(['edit']))).toBe(true)
    expect(await satisfiesRequirement(user, permissionRequirement(['edit', 'publish']))).toBe(false)
    expect(await satisfiesRequirement(user, permissionRequirement(['edit', 'publish'], { any: true }))).toBe(true)
    expect(await satisfiesRequirement(user, roleRequirement(['admin|writer']))).toBe(true)
    expect(await satisfiesRequirement(user, roleRequirement(['admin', 'writer'], { all: true }))).toBe(false)
    expect(await satisfiesRequirement(user, roleOrPermissionRequirement(['admin|edit']))).toBe(true)
    expect(await satisfiesRequirement(user, roleOrPermissionRequirement(['admin|publish']))).toBe(false)
  })
})
