/** Methods that mirror spatie/laravel-permission APIs not covered elsewhere. */
import { beforeEach, describe, expect, it } from 'vitest'
import { createRbac, MemoryAdapter, PermissionDoesNotExist, type Rbac } from '../src'

const alice = { type: 'user', id: 1 }

describe('spatie parity', () => {
  let rbac: Rbac

  beforeEach(async () => {
    rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await rbac.sync([
      { permissions: ['edit', 'delete', 'publish'], roles: { writer: ['edit'], editor: ['edit', 'publish'] } },
      { guard: 'api', permissions: ['edit'], roles: { admin: '*' } },
      { team: 'acme', roles: { 'team-lead': ['delete'] } },
    ])
    await rbac.for(alice).givePermissionTo('delete')
    await rbac.for(alice).assignRole('writer')
  })

  it('hasAnyDirectPermission / hasAllDirectPermissions ignore roles and never throw', async () => {
    const user = rbac.for(alice)
    expect(await user.hasAnyDirectPermission('edit', 'delete')).toBe(true)
    expect(await user.hasAnyDirectPermission('edit', 'publish')).toBe(false) // edit comes from a role
    expect(await user.hasAllDirectPermissions('delete')).toBe(true)
    expect(await user.hasAllDirectPermissions(['delete', 'edit'])).toBe(false)
    expect(await user.hasAnyDirectPermission('unknown')).toBe(false)
    expect(await user.hasAllDirectPermissions()).toBe(true) // like hasAllPermissions(): nothing to check
  })

  it('checkPermissionTo is hasPermissionTo without throwing', async () => {
    const user = rbac.for(alice)
    expect(await user.checkPermissionTo('edit')).toBe(true)
    expect(await user.checkPermissionTo('publish')).toBe(false)
    await expect(user.hasPermissionTo('unknown')).rejects.toBeInstanceOf(PermissionDoesNotExist)
    expect(await user.checkPermissionTo('unknown')).toBe(false)
    const apiEdit = await rbac.findPermissionOrFail('edit', { guard: 'api' })
    expect(await user.checkPermissionTo(apiEdit)).toBe(false) // another guard
  })

  it('findRoleById / findPermissionById look up by id within a guard', async () => {
    const writer = await rbac.findRoleOrFail('writer')
    const edit = await rbac.findPermissionOrFail('edit')
    expect(await rbac.findRoleById(writer.id)).toEqual(writer)
    expect(await rbac.findPermissionById(edit.id)).toEqual(edit)
    expect(await rbac.findRoleById(writer.id, { guard: 'api' })).toBeNull()
    expect(await rbac.findPermissionById(edit.id, { guard: 'api' })).toBeNull()
    expect(await rbac.findRoleById('999999')).toBeNull()
  })

  it('rolesWithPermission lists the roles that grant a permission in the scope', async () => {
    expect((await rbac.rolesWithPermission('edit')).map((r) => r.name).sort()).toEqual(['editor', 'writer'])
    expect((await rbac.rolesWithPermission('publish')).map((r) => r.name)).toEqual(['editor'])
    expect((await rbac.rolesWithPermission('edit', { guard: 'api' })).map((r) => r.name)).toEqual(['admin'])
    expect(await rbac.rolesWithPermission('delete')).toEqual([]) // only granted directly and in team acme
    expect((await rbac.rolesWithPermission('delete', { team: 'acme' })).map((r) => r.name)).toEqual(['team-lead'])
    await expect(rbac.rolesWithPermission('unknown')).rejects.toBeInstanceOf(PermissionDoesNotExist)
  })

  it('withScope checks the same subject in another guard or team', async () => {
    await rbac.for(alice, { guard: 'api' }).assignRole('admin')
    await rbac.for(alice, { team: 'acme' }).assignRole('team-lead')
    const user = rbac.for(alice)

    expect(await user.hasRole('admin')).toBe(false)
    expect(await user.withScope({ guard: 'api' }).hasRole('admin')).toBe(true)
    expect(await user.withScope({ team: 'acme' }).hasRole('team-lead')).toBe(true)
    expect(await user.withScope({ team: 'acme' }).hasRole('writer')).toBe(false) // writer is global, not in acme
    const api = user.withScope({ guard: 'api' })
    expect([api.guardName, api.teamId, api.subject]).toEqual(['api', null, alice])
    expect(api.withScope({}).guardName).toBe('api') // options left out keep the current scope
    expect(user.withScope({ team: 'acme' }).withScope({ team: null }).teamId).toBeNull()
  })
})
