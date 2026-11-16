import { beforeEach, describe, expect, it } from 'vitest'
import { createRbac, GuardDoesNotMatch, MemoryAdapter, PermissionDoesNotExist, type Rbac, RbacError } from '../src'

const sorted = (ids: readonly (string | number)[]) => [...ids].map(String).sort()

describe('subjectsWithPermission({ expandWildcards })', () => {
  let rbac: Rbac

  beforeEach(async () => {
    rbac = createRbac({ adapter: new MemoryAdapter(), wildcard: true, cache: false })
    await rbac.sync({
      permissions: ['articles.edit', 'articles.*', '*', 'articles.edit,delete', 'posts.edit', 'articles'],
      roles: { editor: ['articles.*'], root: ['*'], poster: ['posts.edit'] },
    })
    await rbac.for({ type: 'user', id: 1 }).givePermissionTo('articles.edit') // exact, direct
    await rbac.for({ type: 'user', id: 2 }).assignRole('editor') // articles.* via role
    await rbac.for({ type: 'user', id: 3 }).givePermissionTo('*') // * direct
    await rbac.for({ type: 'user', id: 4 }).assignRole('poster') // unrelated
    await rbac.for({ type: 'user', id: 5 }).givePermissionTo('articles.edit,delete') // subparts, direct
    await rbac.for({ type: 'user', id: 6 }).assignRole('root') // * via role
    await rbac.for({ type: 'user', id: 7 }).givePermissionTo('articles') // shorter name, direct
  })

  it('keeps the exact behaviour by default', async () => {
    expect(await rbac.subjectsWithPermission('user', 'articles.edit')).toEqual([1])
    await expect(rbac.subjectsWithPermission('user', 'articles.publish')).rejects.toBeInstanceOf(PermissionDoesNotExist)
  })

  it('returns holders of wildcards that imply the name, directly and via roles', async () => {
    const ids = await rbac.subjectsWithPermission('user', 'articles.edit', { expandWildcards: true })
    expect(sorted(ids)).toEqual(['1', '2', '3', '5', '6', '7'])
  })

  it('accepts names that are not stored', async () => {
    const ids = await rbac.subjectsWithPermission('user', 'articles.publish', { expandWildcards: true })
    expect(sorted(ids)).toEqual(['2', '3', '6', '7'])
    expect(sorted(await rbac.subjectsWithPermission('user', 'nothing.here', { expandWildcards: true }))).toEqual(['3', '6'])
  })

  it('matches ANY of several names, and Permission objects', async () => {
    const posts = await rbac.findPermissionOrFail('posts.edit')
    const ids = await rbac.subjectsWithPermission('user', ['articles.delete', posts], { expandWildcards: true })
    expect(sorted(ids)).toEqual(['2', '3', '4', '5', '6', '7'])
  })

  it('agrees with can() for every subject', async () => {
    for (const name of ['articles.edit', 'articles.delete', 'articles.create', 'posts.edit', 'posts.delete']) {
      const ids = new Set(sorted(await rbac.subjectsWithPermission('user', name, { expandWildcards: true })))
      for (let id = 1; id <= 7; id++) {
        expect(ids.has(String(id)), `${name} for user ${id}`).toBe(await rbac.for({ type: 'user', id }).can(name))
      }
    }
  })

  it('respects the subject type and an invalid query name matches nothing', async () => {
    await rbac.for({ type: 'client', id: 9 }).givePermissionTo('articles.*')
    expect(await rbac.subjectsWithPermission('client', 'articles.edit', { expandWildcards: true })).toEqual([9])
    expect(await rbac.subjectsWithPermission('client', 'articles..edit', { expandWildcards: true })).toEqual([])
  })

  it('validates names and guards', async () => {
    await expect(rbac.subjectsWithPermission('user', '  ', { expandWildcards: true })).rejects.toBeInstanceOf(RbacError)
    const other = await rbac.createPermission('articles.edit', { guard: 'api' })
    await expect(rbac.subjectsWithPermission('user', other, { expandWildcards: true })).rejects.toBeInstanceOf(
      GuardDoesNotMatch,
    )
  })

  it('returns nothing when the guard has no matching permission', async () => {
    expect(await rbac.subjectsWithPermission('user', 'articles.edit', { expandWildcards: true, guard: 'api' })).toEqual([])
  })

  it('is scoped to a team', async () => {
    const teams = createRbac({ adapter: new MemoryAdapter(), wildcard: true, teams: true })
    await teams.sync({ permissions: ['billing.*'], roles: { owner: ['billing.*'] } })
    await teams.for({ type: 'user', id: 1 }, { team: 1 }).assignRole('owner')
    await teams.for({ type: 'user', id: 2 }, { team: 2 }).givePermissionTo('billing.*')
    expect(await teams.subjectsWithPermission('user', 'billing.view', { team: 1, expandWildcards: true })).toEqual([1])
    expect(await teams.subjectsWithPermission('user', 'billing.view', { team: 2, expandWildcards: true })).toEqual([2])
  })

  it('has no effect when wildcards are off', async () => {
    const plain = createRbac({ adapter: new MemoryAdapter() })
    await plain.sync({ permissions: ['articles.*', 'articles.edit'] })
    await plain.for({ type: 'user', id: 1 }).givePermissionTo('articles.*')
    expect(await plain.subjectsWithPermission('user', 'articles.edit', { expandWildcards: true })).toEqual([])
    await expect(plain.subjectsWithPermission('user', 'articles.view', { expandWildcards: true })).rejects.toBeInstanceOf(
      PermissionDoesNotExist,
    )
  })
})
