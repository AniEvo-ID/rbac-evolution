/**
 * Several app processes (two `Rbac` instances) on one database and one shared cache store, like
 * two servers behind a load balancer with Redis. A change made through one instance must be seen by
 * the other on its next check, never served from a stale cache entry.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { type CacheStore, createRbac, MemoryAdapter, MemoryCache, type Rbac } from '../src'

/** Redis-like: async, and values go through JSON like they would over the wire. */
class SharedStore implements CacheStore {
  readonly data = new Map<string, { json: string; expiresAt: number }>()
  async get(key: string): Promise<unknown> {
    await new Promise((resolve) => setTimeout(resolve, 0))
    const entry = this.data.get(key)
    if (!entry || entry.expiresAt <= Date.now()) return undefined
    return JSON.parse(entry.json)
  }
  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
    this.data.set(key, { json: JSON.stringify(value), expiresAt: Date.now() + ttlMs })
  }
  async clear(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
    this.data.clear()
  }
}

const alice = { type: 'user', id: 1 }

describe('shared cache store across processes', () => {
  let store: SharedStore
  let a: Rbac
  let b: Rbac

  beforeEach(async () => {
    const database = new MemoryAdapter()
    store = new SharedStore()
    a = createRbac({ adapter: database, cache: store })
    b = createRbac({ adapter: database, cache: store })

    await a.createPermission('edit articles')
    await a.createPermission('publish articles')
    await a.createRole('writer')
    await a.role('writer').givePermissionTo('edit articles')
    await a.for(alice).assignRole('writer')
    await a.for(alice).givePermissionTo('publish articles')

    // Warm the shared cache from process A.
    expect(await a.for(alice).can('edit articles')).toBe(true)
    expect(await a.for(alice).can('publish articles')).toBe(true)
    expect(store.data.size).toBeGreaterThan(0)
  })

  it('a direct permission revoked in B is denied in A', async () => {
    await b.for(alice).revokePermissionTo('publish articles')
    expect(await a.for(alice).can('publish articles')).toBe(false)
  })

  it('a role removed in B is gone in A, with its permissions', async () => {
    await b.for(alice).removeRole('writer')
    expect(await a.for(alice).hasRole('writer')).toBe(false)
    expect(await a.for(alice).can('edit articles')).toBe(false)
  })

  it("a permission taken from the role in B is denied in A", async () => {
    await b.role('writer').revokePermissionTo('edit articles')
    expect(await a.for(alice).can('edit articles')).toBe(false)
  })

  it('a permission deleted in B is denied in A', async () => {
    await b.deletePermission('edit articles')
    expect(await a.for(alice).can('edit articles')).toBe(false)
  })

  it('a role deleted in B is gone in A', async () => {
    await b.deleteRole('writer')
    expect(await a.for(alice).hasRole('writer')).toBe(false)
    expect(await a.for(alice).can('edit articles')).toBe(false)
  })

  it('syncRoles and syncPermissions in B are seen in A', async () => {
    await b.for(alice).syncRoles([])
    await b.for(alice).syncPermissions([])
    expect(await a.for(alice).getRoleNames()).toEqual([])
    expect(await a.for(alice).can('edit articles')).toBe(false)
    expect(await a.for(alice).can('publish articles')).toBe(false)
  })

  it('a grant in B is seen in A too', async () => {
    await b.createPermission('delete articles')
    await b.role('writer').givePermissionTo('delete articles')
    expect(await a.for(alice).can('delete articles')).toBe(true)
  })

  it('works the same through JSON: values read back from the store still match by id', async () => {
    // Read twice so the second check is served from the JSON copy in the store.
    expect(await a.for(alice).hasRole(await a.findRoleOrFail('writer'))).toBe(true)
    expect(await a.for(alice).hasRole(await a.findRoleOrFail('writer'))).toBe(true)
  })
})

describe('per-process cache (documented limitation)', () => {
  it('without a shared store, the other process keeps its cached answer until the TTL', async () => {
    // This is why multi-instance deployments need a shared store, a short TTL or no cache
    // (docs/best-practices/security.md). If this starts failing, update that page.
    const database = new MemoryAdapter()
    const a = createRbac({ adapter: database, cache: new MemoryCache() })
    const b = createRbac({ adapter: database, cache: new MemoryCache() })
    await a.createPermission('edit articles')
    await a.for(alice).givePermissionTo('edit articles')
    expect(await a.for(alice).can('edit articles')).toBe(true)

    await b.for(alice).revokePermissionTo('edit articles')
    expect(await b.for(alice).can('edit articles')).toBe(false)
    expect(await a.for(alice).can('edit articles')).toBe(true) // stale, by design

    await a.forgetCachedPermissions()
    expect(await a.for(alice).can('edit articles')).toBe(false)
  })
})
