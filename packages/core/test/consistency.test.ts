import { describe, expect, it } from 'vitest'
import { createRbac, MemoryAdapter } from '../src'

const user = { type: 'user', id: 1 }

describe('cache consistency', () => {
  it('does not cache a lookup that raced with a role change', async () => {
    const adapter = new MemoryAdapter()
    const rbac = createRbac({ adapter })
    await rbac.createPermission('edit articles')
    await rbac.createRole('admin')
    await rbac.role('admin').givePermissionTo('edit articles')
    await rbac.for(user).assignRole('admin')

    // Pause the first role lookup until the role has been removed.
    let release!: () => void
    const paused = new Promise<void>((r) => (release = r))
    const original = adapter.getSubjectRoleIds.bind(adapter)
    let calls = 0
    adapter.getSubjectRoleIds = async (subject, teamId) => {
      const ids = await original(subject, teamId)
      if (calls++ === 0) await paused
      return ids
    }

    const slowCheck = rbac.for(user).can('edit articles') // reads roles = [admin], then waits
    await new Promise((r) => setTimeout(r, 0))
    await rbac.for(user).removeRole('admin') // clears the cache while the lookup is in flight
    release()

    expect(await slowCheck).toBe(true) // that request started before the change
    expect(await rbac.for(user).can('edit articles')).toBe(false) // but its stale result was not cached
  })
})

describe('sync never leaves a subject empty-handed', () => {
  it('keeps the old roles when attaching the new ones fails', async () => {
    const adapter = new MemoryAdapter()
    const rbac = createRbac({ adapter, cache: false }) // read what is really stored
    await rbac.createRole('admin')
    await rbac.createRole('editor')
    await rbac.for(user).assignRole('admin')

    adapter.attachSubjectRoles = async () => {
      throw new Error('connection lost')
    }
    await expect(rbac.for(user).syncRoles('editor')).rejects.toThrow('connection lost')
    expect(await rbac.for(user).getRoleNames()).toEqual(['admin'])
  })

  it('keeps the old direct permissions when attaching the new ones fails', async () => {
    const adapter = new MemoryAdapter()
    const rbac = createRbac({ adapter, cache: false }) // read what is really stored
    await rbac.createPermission('edit')
    await rbac.createPermission('publish')
    await rbac.for(user).givePermissionTo('edit')

    adapter.attachSubjectPermissions = async () => {
      throw new Error('connection lost')
    }
    await expect(rbac.for(user).syncPermissions('publish')).rejects.toThrow('connection lost')
    expect(await rbac.for(user).getPermissionNames()).toEqual(['edit'])
  })

  it("keeps a role's old permissions when attaching the new ones fails", async () => {
    const adapter = new MemoryAdapter()
    const rbac = createRbac({ adapter, cache: false }) // read what is really stored
    await rbac.createPermission('edit')
    await rbac.createPermission('publish')
    await rbac.createRole('writer')
    await rbac.role('writer').givePermissionTo('edit')

    adapter.attachRolePermissions = async () => {
      throw new Error('connection lost')
    }
    await expect(rbac.role('writer').syncPermissions('publish')).rejects.toThrow('connection lost')
    expect(await rbac.role('writer').getPermissionNames()).toEqual(['edit'])
  })

  it('still replaces the lists when nothing fails', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    for (const p of ['edit', 'publish']) await rbac.createPermission(p)
    for (const r of ['admin', 'editor']) await rbac.createRole(r)
    await rbac.for(user).assignRole('admin')
    await rbac.for(user).givePermissionTo('edit')
    await rbac.role('editor').givePermissionTo('edit')

    await rbac.for(user).syncRoles('editor')
    await rbac.for(user).syncPermissions('publish')
    await rbac.role('editor').syncPermissions('publish')

    expect(await rbac.for(user).getRoleNames()).toEqual(['editor'])
    expect((await rbac.for(user).getDirectPermissions()).map((p) => p.name)).toEqual(['publish'])
    expect(await rbac.role('editor').getPermissionNames()).toEqual(['publish'])
  })
})

describe('MemoryCache', () => {
  it('keeps at most maxEntries, dropping the oldest write first', async () => {
    const { MemoryCache } = await import('../src/cache')
    const cache = new MemoryCache({ maxEntries: 3 })
    for (const k of ['a', 'b', 'c']) cache.set(k, k, 60_000)
    cache.set('a', 'a2', 60_000) // rewrite: 'a' becomes the newest
    cache.set('d', 'd', 60_000) // full: drops 'b', the oldest write
    expect(cache.size).toBe(3)
    expect(cache.get('b')).toBeUndefined()
    expect([cache.get('a'), cache.get('c'), cache.get('d')]).toEqual(['a2', 'c', 'd'])
  })

  it('stays bounded under many distinct subjects', async () => {
    const { MemoryCache } = await import('../src/cache')
    const cache = new MemoryCache({ maxEntries: 50 })
    const rbac = createRbac({ adapter: new MemoryAdapter(), cache })
    await rbac.createPermission('read')
    for (let id = 0; id < 500; id++) await rbac.for({ type: 'user', id }).can('read')
    expect(cache.size).toBe(50)
    expect(await rbac.for({ type: 'user', id: 1 }).can('read')).toBe(false) // evicted entries are just recomputed
  })
})
