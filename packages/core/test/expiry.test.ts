/**
 * Expiry on role assignments and direct permissions (1.2), with a fake engine clock.
 */
import { describe, expect, it } from 'vitest'
import {
  type CacheStore,
  createRbac,
  MemoryAdapter,
  type RbacAdapter,
  RbacError,
  type RbacEvent,
  type RbacOptions,
} from '../src'

const alice = { type: 'user', id: 1 }
const bob = { type: 'user', id: 2 }
const HOUR = 3600_000
const T0 = new Date('2030-01-01T00:00:00Z').getTime()

/** A fake clock plus an engine on an expiry-enabled MemoryAdapter. */
function setup(options: Partial<RbacOptions> = {}) {
  const clock = { now: T0 }
  const adapter = (options.adapter as MemoryAdapter | undefined) ?? new MemoryAdapter({ expiry: true })
  const rbac = createRbac({ cache: false, ...options, adapter, now: () => new Date(clock.now) })
  const events: RbacEvent[] = []
  for (const name of ['role.attached', 'role.detached', 'permission.attached', 'permission.detached'] as const) {
    rbac.on(name, (e) => void events.push(e))
  }
  const at = (hours: number): Date => new Date(T0 + hours * HOUR)
  return { clock, adapter, rbac, events, at }
}

async function seed(rbac: ReturnType<typeof setup>['rbac']): Promise<void> {
  await rbac.createPermission('read')
  await rbac.createPermission('impersonate')
  await rbac.createRole('on-call')
  await rbac.createRole('viewer')
  await rbac.role('on-call').givePermissionTo('read')
}

describe('expiry: adapter support', () => {
  it('refuses an expiresAt the adapter cannot store, before writing anything', async () => {
    const adapter = new MemoryAdapter()
    const rbac = createRbac({ adapter, cache: false })
    await seed(rbac)
    const user = rbac.for(alice)
    const expiresAt = new Date(Date.now() + HOUR)
    for (const write of [
      () => user.assignRole('on-call', { expiresAt }),
      () => user.givePermissionTo('impersonate', { expiresAt }),
      () => user.syncRoles(['on-call'], { expiresAt }),
      () => user.syncPermissions('impersonate', { expiresAt }),
    ]) {
      const error = await write().catch((e: unknown) => e)
      expect(error).toBeInstanceOf(RbacError)
      expect((error as RbacError).code).toBe('EXPIRY_NOT_SUPPORTED')
    }
    expect(await user.getRoleNames()).toEqual([])
    expect(await user.getDirectPermissions()).toEqual([])
  })

  it('accepts `expiresAt: null` (permanent) and no options on any adapter, as in 1.1', async () => {
    const adapter = new MemoryAdapter()
    const rbac = createRbac({ adapter })
    await seed(rbac)
    await rbac.for(alice).assignRole('on-call', { expiresAt: null })
    await rbac.for(alice).givePermissionTo('impersonate', {})
    expect(await rbac.for(alice).getRoleAssignments()).toEqual([
      { role: expect.objectContaining({ name: 'on-call' }), expiresAt: null },
    ])
    expect(await rbac.for(alice).can('impersonate')).toBe(true)
    expect(await rbac.pruneExpired()).toEqual({ roles: 0, permissions: 0 })
  })

  it('rejects an invalid date with a TypeError', async () => {
    const { rbac } = setup()
    await seed(rbac)
    await expect(rbac.for(alice).assignRole('on-call', { expiresAt: new Date('nope') })).rejects.toBeInstanceOf(TypeError)
    await expect(
      rbac.for(alice).assignRole('on-call', { expiresAt: '2030-01-01' as unknown as Date }),
    ).rejects.toBeInstanceOf(TypeError)
  })

  it('does not mistake a role or permission object for the options', async () => {
    const { rbac } = setup()
    await seed(rbac)
    const role = await rbac.findRoleOrFail('viewer')
    const permission = await rbac.findPermissionOrFail('impersonate')
    await rbac.for(alice).assignRole('on-call', role)
    await rbac.for(alice).givePermissionTo(permission)
    expect((await rbac.for(alice).getRoleNames()).sort()).toEqual(['on-call', 'viewer'])
    expect(await rbac.for(alice).hasDirectPermission('impersonate')).toBe(true)
  })

  it('throws ADAPTER_METHOD_MISSING when an adapter declares supportsExpiry without the expiry reads', async () => {
    const inner = new MemoryAdapter({ expiry: true })
    const adapter = new Proxy(inner, {
      get(target, key, receiver) {
        if (key === 'getSubjectRoleLinks' || key === 'getSubjectPermissionLinks' || key === 'deleteExpiredLinks') {
          return undefined
        }
        const value: unknown = Reflect.get(target, key, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    }) as RbacAdapter
    const rbac = createRbac({ adapter, cache: false })
    await seed(rbac)
    await rbac.for(alice).assignRole('on-call', { expiresAt: new Date(Date.now() + HOUR) })
    await expect(rbac.for(alice).hasRole('on-call')).rejects.toMatchObject({ code: 'ADAPTER_METHOD_MISSING' })
    await expect(rbac.pruneExpired()).rejects.toMatchObject({ code: 'ADAPTER_METHOD_MISSING' })
    await expect(rbac.for(alice).revokeAll()).rejects.toMatchObject({ code: 'ADAPTER_METHOD_MISSING' })
  })
})

describe('expiry: checks follow the engine clock', () => {
  it('treats a link as absent from expiresAt on, in every read', async () => {
    const { rbac, clock, at } = setup({ teams: true })
    await seed(rbac)
    const user = rbac.for(alice)
    await user.assignRole('on-call', { expiresAt: at(8) })
    await user.givePermissionTo('impersonate', { expiresAt: at(1) })
    await rbac.for(alice, { team: 'acme' }).assignRole('viewer', { expiresAt: at(2) })

    expect(await user.can('read')).toBe(true)
    expect(await user.can('impersonate')).toBe(true)
    expect(await user.getRoleAssignments()).toEqual([{ role: expect.objectContaining({ name: 'on-call' }), expiresAt: at(8) }])
    expect(await user.getDirectPermissionAssignments()).toEqual([
      { permission: expect.objectContaining({ name: 'impersonate' }), expiresAt: at(1) },
    ])
    expect(await user.teams()).toEqual(['acme'])

    clock.now = at(1).getTime() // exactly at expiresAt: already gone
    expect(await user.can('impersonate')).toBe(false)
    expect(await user.hasDirectPermission('impersonate')).toBe(false)
    expect(await rbac.subjectsWithPermission('user', 'impersonate')).toEqual([])
    expect(await rbac.subjectsWithPermission('user', 'read')).toEqual([1])

    clock.now = at(2).getTime()
    expect(await user.teams()).toEqual([])

    clock.now = at(8).getTime()
    expect(await user.hasRole('on-call')).toBe(false)
    expect(await user.can('read')).toBe(false)
    expect(await rbac.subjectsWithRole('user', 'on-call')).toEqual([])
    expect(await rbac.subjectsWithPermission('user', 'read')).toEqual([])
    expect(await user.snapshot()).toEqual({ roles: [], permissions: [] })
    expect(await user.getRoleAssignments()).toEqual([])
  })

  it('expires per team and per guard', async () => {
    const { rbac, clock, at } = setup({ teams: true })
    await seed(rbac)
    await rbac.createRole('bot', { guard: 'api' })
    await rbac.for(alice, { team: 'a' }).assignRole('viewer', { expiresAt: at(1) })
    await rbac.for(alice, { team: 'b' }).assignRole('viewer')
    await rbac.for(alice, { guard: 'api' }).assignRole('bot', { expiresAt: at(3) })
    clock.now = at(2).getTime()
    expect(await rbac.for(alice, { team: 'a' }).hasRole('viewer')).toBe(false)
    expect(await rbac.for(alice, { team: 'b' }).hasRole('viewer')).toBe(true)
    expect(await rbac.for(alice, { guard: 'api' }).hasRole('bot')).toBe(true)
    expect(await rbac.for(alice).teams({ allGuards: true })).toEqual(['b'])
  })
})

describe('expiry: re-assigning (the latest call wins)', () => {
  it('extends, shortens or makes permanent, and emits role.attached only when the expiry changes', async () => {
    const { rbac, events, at } = setup()
    await seed(rbac)
    events.length = 0
    const user = rbac.for(alice)
    await user.assignRole('on-call', { expiresAt: at(8) })
    expect(events).toMatchObject([{ event: 'role.attached', expiresAt: at(8) }])

    await user.assignRole('on-call', { expiresAt: at(8) })
    expect(events).toHaveLength(1)

    await user.assignRole('on-call', { expiresAt: at(12) })
    expect((await user.getRoleAssignments())[0]!.expiresAt).toEqual(at(12))
    await user.assignRole('on-call', { expiresAt: at(2) })
    expect((await user.getRoleAssignments())[0]!.expiresAt).toEqual(at(2))
    await user.assignRole('on-call')
    expect((await user.getRoleAssignments())[0]!.expiresAt).toBeNull()
    expect(events.map((e) => (e as { expiresAt?: Date | null }).expiresAt)).toEqual([at(8), at(12), at(2), null])

    await user.givePermissionTo('impersonate', { expiresAt: at(1) })
    await user.givePermissionTo('impersonate')
    expect((await user.getDirectPermissionAssignments())[0]!.expiresAt).toBeNull()
    expect(events.slice(-2)).toMatchObject([
      { event: 'permission.attached', target: 'subject', expiresAt: at(1) },
      { event: 'permission.attached', target: 'subject', expiresAt: null },
    ])
  })

  it('re-assigning an expired role makes it active again, and is reported as attached', async () => {
    const { rbac, clock, events, at } = setup()
    await seed(rbac)
    await rbac.for(alice).assignRole('on-call', { expiresAt: at(1) })
    clock.now = at(2).getTime()
    events.length = 0
    await rbac.for(alice).assignRole('on-call', { expiresAt: at(4) })
    expect(await rbac.for(alice).hasRole('on-call')).toBe(true)
    expect(events).toMatchObject([{ event: 'role.attached', roles: [{ name: 'on-call' }], expiresAt: at(4) }])
  })

  it('removing an expired link emits no detached event', async () => {
    const { rbac, clock, events, at } = setup()
    await seed(rbac)
    await rbac.for(alice).assignRole('on-call', { expiresAt: at(1) })
    await rbac.for(alice).givePermissionTo('impersonate', { expiresAt: at(1) })
    clock.now = at(2).getTime()
    events.length = 0
    await rbac.for(alice).removeRole('on-call')
    await rbac.for(alice).revokePermissionTo('impersonate')
    expect(events).toEqual([])
    expect(await rbac.for(alice).getRoleAssignments()).toEqual([])
  })

  it('without expiry support, payloads have no expiresAt key (as in 1.1)', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await seed(rbac)
    const events: RbacEvent[] = []
    rbac.on('role.attached', (e) => void events.push(e))
    await rbac.for(alice).assignRole('on-call')
    expect(Object.keys(events[0]!)).not.toContain('expiresAt')
  })
})

describe('expiry: syncRoles / syncPermissions', () => {
  it('without expiresAt, kept links keep their expiry and new links are permanent', async () => {
    const { rbac, clock, events, at } = setup()
    await seed(rbac)
    const user = rbac.for(alice)
    await user.assignRole('on-call', { expiresAt: at(8) })
    await user.givePermissionTo('impersonate', { expiresAt: at(8) })
    events.length = 0

    await user.syncRoles('on-call', 'viewer')
    await user.syncPermissions('impersonate', 'read')
    const roles = Object.fromEntries((await user.getRoleAssignments()).map((a) => [a.role.name, a.expiresAt]))
    expect(roles).toEqual({ 'on-call': at(8), viewer: null })
    const direct = Object.fromEntries((await user.getDirectPermissionAssignments()).map((a) => [a.permission.name, a.expiresAt]))
    expect(direct).toEqual({ impersonate: at(8), read: null })
    expect(events).toMatchObject([
      { event: 'role.attached', roles: [{ name: 'viewer' }], expiresAt: null },
      { event: 'permission.attached', permissions: [{ name: 'read' }], expiresAt: null },
    ])

    // An expired link in the list is not held, so the sync adds it back, permanently.
    clock.now = at(9).getTime()
    await user.syncRoles('on-call', 'viewer')
    expect((await user.getRoleAssignments()).map((a) => [a.role.name, a.expiresAt])).toEqual([
      ['on-call', null],
      ['viewer', null],
    ])
  })

  it('with expiresAt, every listed link gets it, and the others go', async () => {
    const { rbac, events, at } = setup()
    await seed(rbac)
    const user = rbac.for(alice)
    await user.assignRole('on-call')
    await user.assignRole('viewer', { expiresAt: at(1) })
    await user.givePermissionTo('read')
    events.length = 0

    await user.syncRoles(['on-call'], { expiresAt: at(4) })
    await user.syncPermissions(['impersonate'], { expiresAt: null })
    expect(await user.getRoleAssignments()).toEqual([{ role: expect.objectContaining({ name: 'on-call' }), expiresAt: at(4) }])
    expect(await user.getDirectPermissionAssignments()).toEqual([
      { permission: expect.objectContaining({ name: 'impersonate' }), expiresAt: null },
    ])
    expect(events).toMatchObject([
      { event: 'role.detached', roles: [{ name: 'viewer' }] },
      { event: 'role.attached', roles: [{ name: 'on-call' }], expiresAt: at(4) },
      { event: 'permission.detached', permissions: [{ name: 'read' }] },
      { event: 'permission.attached', permissions: [{ name: 'impersonate' }], expiresAt: null },
    ])
  })

  it('role.syncSubjects re-assigns a subject whose assignment expired', async () => {
    const { rbac, clock, at } = setup()
    await seed(rbac)
    await rbac.for(alice).assignRole('viewer', { expiresAt: at(1) })
    await rbac.for(bob).assignRole('viewer')
    clock.now = at(2).getTime()
    await rbac.role('viewer').syncSubjects('user', [1])
    expect(await rbac.for(alice).getRoleAssignments()).toEqual([
      { role: expect.objectContaining({ name: 'viewer' }), expiresAt: null },
    ])
    expect(await rbac.for(bob).hasRole('viewer')).toBe(false)
  })
})

describe('expiry: bulk operations', () => {
  it('revokeAll and deleteTeam remove expired links too, but only report the active ones', async () => {
    const { rbac, clock, events, at } = setup({ teams: true })
    await seed(rbac)
    await rbac.for(alice).assignRole('on-call', { expiresAt: at(1) })
    await rbac.for(alice).assignRole('viewer')
    await rbac.for(alice).givePermissionTo('impersonate', { expiresAt: at(1) })
    await rbac.for(bob, { team: 'acme' }).assignRole('on-call', { expiresAt: at(1) })
    await rbac.for(bob, { team: 'acme' }).givePermissionTo('read')
    await rbac.for(alice, { team: 'beta' }).assignRole('viewer', { expiresAt: at(1) })
    clock.now = at(2).getTime()
    events.length = 0

    await rbac.for(alice).revokeAll()
    await rbac.deleteTeam('acme')
    await rbac.for(alice).revokeAll({ allTeams: true })
    expect(events).toMatchObject([
      { event: 'role.detached', roles: [{ name: 'viewer' }], teamId: null },
      { event: 'permission.detached', subject: bob, permissions: [{ name: 'read' }], teamId: 'acme' },
    ])
    expect(events).toHaveLength(2)
    // Nothing is left to prune: the bulk removals took the expired rows too.
    expect(await rbac.pruneExpired()).toEqual({ roles: 0, permissions: 0 })
  })
})

describe('expiry: pruneExpired()', () => {
  it('deletes expired links of every subject, without events or access changes', async () => {
    const { rbac, adapter, clock, events, at } = setup({ teams: true })
    await seed(rbac)
    await rbac.for(alice).assignRole('on-call', { expiresAt: at(1) })
    await rbac.for(bob, { team: 'x' }).givePermissionTo('read', { expiresAt: at(1) })
    await rbac.for(bob).assignRole('viewer', { expiresAt: at(5) })
    await rbac.for(bob).assignRole('on-call')
    clock.now = at(2).getTime()
    events.length = 0

    expect(await rbac.pruneExpired()).toEqual({ roles: 1, permissions: 1 })
    expect(events).toEqual([])
    expect(await adapter.getSubjectRoleIds(alice, null)).toEqual([])
    expect((await rbac.for(bob).getRoleNames()).sort()).toEqual(['on-call', 'viewer'])
    expect(await rbac.pruneExpired()).toEqual({ roles: 0, permissions: 0 })
  })
})

describe('expiry: cache', () => {
  /** Records every `set`, and serves values through JSON like Redis. Ignores TTLs unless `honourTtl`. */
  class RecordingStore implements CacheStore {
    readonly sets: { key: string; ttl: number }[] = []
    readonly data = new Map<string, string>()
    get(key: string): unknown {
      const json = this.data.get(key)
      return json === undefined ? undefined : JSON.parse(json)
    }
    set(key: string, value: unknown, ttl: number): void {
      this.sets.push({ key, ttl })
      this.data.set(key, JSON.stringify(value))
    }
    clear(): void {
      this.data.clear()
    }
  }

  it('caps the TTL of a subject state at its earliest expiry', async () => {
    const store = new RecordingStore()
    const { rbac, clock, at } = setup({ cache: store, cacheTtl: 24 * HOUR })
    await seed(rbac)
    await rbac.for(alice).assignRole('on-call', { expiresAt: at(8) })
    await rbac.for(alice).givePermissionTo('impersonate', { expiresAt: at(2) })
    await rbac.for(bob).assignRole('viewer', { expiresAt: at(48) })
    clock.now = at(0.5).getTime()

    expect(await rbac.for(alice).hasRole('on-call')).toBe(true)
    expect(await rbac.for(bob).hasRole('viewer')).toBe(true)
    const ttl = (id: number) => store.sets.find((s) => s.key === `rbac:${JSON.stringify(['web', null, 'user', String(id)])}`)!.ttl
    expect(ttl(1)).toBe(1.5 * HOUR) // impersonate ends first
    expect(ttl(2)).toBe(24 * HOUR) // further than cacheTtl: cacheTtl
  })

  it('does not serve a cached state past its expiry, even when the store keeps it longer', async () => {
    const store = new RecordingStore() // never evicts: like Redis with TTLs rounded up, or a clock skew
    const { rbac, clock, at } = setup({ cache: store })
    await seed(rbac)
    await rbac.for(alice).assignRole('on-call', { expiresAt: at(1) })
    expect(await rbac.for(alice).can('read')).toBe(true)
    expect(store.data.size).toBeGreaterThan(0)

    clock.now = at(1).getTime()
    expect(await rbac.for(alice).can('read')).toBe(false)
    expect(await rbac.for(alice).hasRole('on-call')).toBe(false)
  })

  it('keeps the full cacheTtl and the 1.1 state shape for permanent links', async () => {
    const store = new RecordingStore()
    const { rbac } = setup({ cache: store, cacheTtl: 1000 })
    await seed(rbac)
    await rbac.for(alice).assignRole('on-call')
    await rbac.for(alice).hasRole('on-call')
    const key = `rbac:${JSON.stringify(['web', null, 'user', '1'])}`
    expect(store.sets.find((s) => s.key === key)!.ttl).toBe(1000)
    expect(Object.keys(JSON.parse(store.data.get(key)!) as object).sort()).toEqual(['direct', 'roles', 'viaRoles'])
  })

  it('caps teams() the same way, under its own key', async () => {
    const store = new RecordingStore()
    const { rbac, clock, at } = setup({ cache: store, teams: true })
    await seed(rbac)
    await rbac.for(alice, { team: 'acme' }).assignRole('viewer', { expiresAt: at(3) })
    await rbac.for(alice, { team: 'beta' }).assignRole('viewer')
    expect((await rbac.for(alice).teams()).sort()).toEqual(['acme', 'beta'])
    const set = store.sets.find((s) => s.key.startsWith('rbac:teams:'))!
    expect(set.key.endsWith(':expiry')).toBe(true)
    expect(set.ttl).toBe(3 * HOUR)

    clock.now = at(3).getTime()
    expect(await rbac.for(alice).teams()).toEqual(['beta'])
  })

  it('never stores an entry whose expiry is due by the time it would be written', async () => {
    const store = new RecordingStore()
    // A clock that moves 1 ms on every read once `tick` is set.
    let tick: number | null = null
    const rbac = createRbac({
      adapter: new MemoryAdapter({ expiry: true }),
      cache: store,
      now: () => new Date(tick === null ? T0 : T0 + tick++),
    })
    await seed(rbac)
    await rbac.for(alice).assignRole('on-call', { expiresAt: new Date(T0 + 2) })
    store.sets.length = 0
    tick = 0
    // Read at T0 (roles) and T0 + 1 (permissions): active. The TTL is then T0 + 2 - (T0 + 2) = 0: not stored.
    expect(await rbac.for(alice).hasRole('on-call')).toBe(true)
    expect(store.sets.filter((s) => s.key.startsWith('rbac:["web"'))).toEqual([])
    expect(await rbac.for(alice).hasRole('on-call')).toBe(false)
  })
})
