import { createRbac, MemoryAdapter, type Rbac } from '@anievo-id/rbac-evolution'
import { Redis } from 'ioredis'
import { createClient } from 'redis'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedisCache, type RedisCacheClient } from '../src'

/** An in-memory server answering GET, SET ... PX, INCR and DEL, like Redis does over the wire (strings only). */
class FakeServer {
  readonly data = new Map<string, { value: string; expiresAt: number }>()
  run([command, ...args]: string[]): unknown {
    const [key = '', value = '', , ms] = args
    const entry = this.data.get(key)
    const live = entry && entry.expiresAt > Date.now() ? entry : undefined
    switch (command) {
      case 'GET':
        return live?.value ?? null
      case 'SET':
        this.data.set(key, { value, expiresAt: ms === undefined ? Infinity : Date.now() + Number(ms) })
        return 'OK'
      case 'INCR': {
        const next = String(Number(live?.value ?? 0) + 1)
        this.data.set(key, { value: next, expiresAt: Infinity })
        return Number(next)
      }
      default:
        throw new Error(`unexpected command ${command}`)
    }
  }
}

const ioStyle = (server: FakeServer): RedisCacheClient => ({
  call: async (command: string, ...args: string[]) => server.run([command, ...args]),
})
const nodeStyle = (server: FakeServer): RedisCacheClient => ({
  sendCommand: async (args: string[]) => server.run(args),
})

const alice = { type: 'user', id: 1 }

describe.each([
  ['ioredis-style client', ioStyle],
  ['node-redis-style client', nodeStyle],
])('RedisCache with an %s', (_name, client) => {
  let server: FakeServer
  let cache: RedisCache

  beforeEach(() => {
    server = new FakeServer()
    cache = new RedisCache({ client: client(server) })
  })

  it('round-trips values through JSON, and misses with undefined', async () => {
    expect(await cache.get('k')).toBeUndefined()
    await cache.set('k', { roles: [{ name: 'writer' }], validUntil: 5 }, 60_000)
    expect(await cache.get('k')).toEqual({ roles: [{ name: 'writer' }], validUntil: 5 })
    expect([...server.data.keys()]).toEqual(['rbac-cache:0:k'])
  })

  it('stores with a PX TTL in whole milliseconds, at least 1', async () => {
    await cache.set('a', 1, 1500.2)
    await cache.set('b', 1, 0.1)
    const ttl = (key: string) => server.data.get(key)!.expiresAt - Date.now()
    expect(ttl('rbac-cache:0:a')).toBeGreaterThan(1400)
    expect(ttl('rbac-cache:0:a')).toBeLessThanOrEqual(1501)
    expect(ttl('rbac-cache:0:b')).toBeLessThanOrEqual(1)
  })

  it('clear() bumps the generation, so older entries are not read', async () => {
    await cache.set('k', 'old', 60_000)
    await cache.clear()
    expect(await cache.get('k')).toBeUndefined()
    await cache.set('k', 'new', 60_000)
    expect(await cache.get('k')).toBe('new')
    expect(server.data.get('rbac-cache:generation')?.value).toBe('1')
  })

  it('uses the prefix for every key', async () => {
    const other = new RedisCache({ client: client(server), prefix: 'app2:' })
    await other.set('k', 1, 60_000)
    await other.clear()
    await cache.set('k', 2, 60_000)
    expect([...server.data.keys()].sort()).toEqual(['app2:0:k', 'app2:generation', 'rbac-cache:0:k'])
    expect(await cache.get('k')).toBe(2)
  })

  it('writes a value computed before another process cleared under the old generation', async () => {
    const other = new RedisCache({ client: client(server) })
    expect(await cache.get('k')).toBeUndefined() // lookup starts in generation 0
    await other.clear() // a change elsewhere
    await cache.set('k', 'computed before the change', 60_000)
    expect(await cache.get('k')).toBeUndefined()
    expect(await other.get('k')).toBeUndefined()
  })

  it('keeps the oldest generation while several lookups of one key overlap', async () => {
    const other = new RedisCache({ client: client(server) })
    await cache.get('k') // lookup 1, generation 0
    await other.clear()
    await cache.get('k') // lookup 2, generation 1
    await cache.set('k', 'from lookup 2', 60_000)
    await cache.set('k', 'from lookup 1 (stale)', 60_000)
    expect(await other.get('k')).toBeUndefined()
    // Both lookups are done: the next one is cached normally.
    await cache.set('k', 'fresh', 60_000)
    expect(await other.get('k')).toBe('fresh')
  })

  it('forgets a lookup that never called set() after a minute', async () => {
    const other = new RedisCache({ client: client(server) })
    const now = Date.now()
    await cache.get('k') // its compute throws: no set()
    await other.clear()
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now + 61_000)
    try {
      await cache.get('k')
      await cache.set('k', 'fresh', 60_000)
      expect(await other.get('k')).toBe('fresh')
    } finally {
      spy.mockRestore()
    }
  })

  it('set() without a get() writes under the current generation', async () => {
    await cache.clear()
    await cache.set('k', 1, 60_000)
    expect(server.data.has('rbac-cache:1:k')).toBe(true)
  })
})

describe('RedisCache with the engine', () => {
  let a: Rbac
  let b: Rbac

  beforeEach(async () => {
    const server = new FakeServer()
    const database = new MemoryAdapter()
    a = createRbac({ adapter: database, cache: new RedisCache({ client: ioStyle(server) }) })
    b = createRbac({ adapter: database, cache: new RedisCache({ client: nodeStyle(server) }) })
    await a.createPermission('edit articles')
    await a.createRole('writer')
    await a.role('writer').givePermissionTo('edit articles')
    await a.for(alice).assignRole('writer')
  })

  it('a change in one process is seen by the other on its next check', async () => {
    expect(await a.for(alice).can('edit articles')).toBe(true)
    expect(await b.for(alice).can('edit articles')).toBe(true)
    await b.for(alice).removeRole('writer')
    expect(await a.for(alice).can('edit articles')).toBe(false)
    expect(await a.for(alice).hasRole('writer')).toBe(false)
  })
})

it('rejects a client without call() or sendCommand()', () => {
  expect(() => new RedisCache({ client: {} as RedisCacheClient })).toThrow(/call\(\).*sendCommand\(\)/)
})

// Real server, e.g. REDIS_URL=redis://localhost:6379
const url = process.env.REDIS_URL
describe.skipIf(url === undefined || url === '')('RedisCache on a real server (REDIS_URL)', () => {
  const prefix = `rbac-test:${process.pid}:`
  const io = new Redis(url!, { lazyConnect: true })
  const node = createClient({ url: url! })

  afterAll(async () => {
    const keys = await io.keys(`${prefix}*`)
    if (keys.length > 0) await io.del(...keys)
    await io.quit()
    await node.quit()
  })

  it('works with ioredis and node-redis on one server', async () => {
    await io.connect()
    await node.connect()
    const viaIo = new RedisCache({ client: io, prefix })
    const viaNode = new RedisCache({ client: node, prefix })

    expect(await viaIo.get('k')).toBeUndefined()
    await viaIo.set('k', { roles: ['writer'] }, 60_000)
    expect(await viaNode.get('k')).toEqual({ roles: ['writer'] })
    expect(Number(await io.pttl(`${prefix}0:k`))).toBeGreaterThan(50_000)

    await viaNode.clear()
    expect(await viaIo.get('k')).toBeUndefined()
    expect(await io.get(`${prefix}generation`)).toBe('1')
  })

  it('runs the engine on a real server', async () => {
    const database = new MemoryAdapter()
    const a = createRbac({ adapter: database, cache: new RedisCache({ client: io, prefix }) })
    const b = createRbac({ adapter: database, cache: new RedisCache({ client: node, prefix }) })
    await a.createPermission('edit articles')
    await a.for(alice).givePermissionTo('edit articles')
    expect(await a.for(alice).can('edit articles')).toBe(true)
    await b.for(alice).revokePermissionTo('edit articles')
    expect(await a.for(alice).can('edit articles')).toBe(false)
  })
})
