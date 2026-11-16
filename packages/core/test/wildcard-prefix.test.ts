import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRbac, MemoryAdapter, RbacError, type RbacOptions } from '../src'
import { resetWarnings } from '../src/warn'
import { findPrefixImplications } from '../src/wildcard'

describe('findPrefixImplications', () => {
  it('finds a shorter name without `*` that implies a longer one', () => {
    expect(findPrefixImplications(['orders.refund', 'orders.refund.large', 'orders.view'])).toEqual([
      ['orders.refund', 'orders.refund.large'],
    ])
    expect(findPrefixImplications(['orders', 'orders.refund.large'])).toEqual([['orders', 'orders.refund.large']])
    expect(findPrefixImplications(['orders.refund,view', 'orders.view.all'])).toEqual([
      ['orders.refund,view', 'orders.view.all'],
    ])
  })

  it('ignores intended wildcards, unrelated, equal-length and invalid names', () => {
    expect(findPrefixImplications(['orders.*', 'orders.refund.large'])).toEqual([])
    expect(findPrefixImplications(['*', 'orders.refund'])).toEqual([])
    expect(findPrefixImplications(['orders.refund', 'orders.view.large', 'orders.view.small'])).toEqual([])
    expect(findPrefixImplications(['orders.refund', 'orders.*.large'])).toEqual([]) // a `*` part is never implied
    expect(findPrefixImplications(['orders.refund', 'orders..large', 'orders.refund'])).toEqual([])
  })

  it('limits the pairs to the focused names', () => {
    const names = ['a', 'a.b', 'c', 'c.d']
    expect(findPrefixImplications(names, new Set(['c.d']))).toEqual([['c', 'c.d']])
    expect(findPrefixImplications(names, new Set(['a']))).toEqual([['a', 'a.b']])
    expect(findPrefixImplications(names, new Set(['x']))).toEqual([])
  })
})

describe('wildcardPrefixCheck', () => {
  let warn: ReturnType<typeof vi.spyOn>
  const make = (options: Partial<RbacOptions> = {}) =>
    createRbac({ adapter: new MemoryAdapter(), wildcard: true, ...options })

  beforeEach(() => {
    resetWarnings()
    vi.stubEnv('NODE_ENV', 'development')
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    warn.mockRestore()
  })

  it('warns once per pair from sync() by default, and still writes', async () => {
    const rbac = make()
    const definition = { permissions: ['orders.refund', 'orders.refund.large', 'orders.view'] }
    await rbac.sync(definition)
    await rbac.sync(definition)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain('`orders.refund` also grants `orders.refund.large`')
    expect((await rbac.getPermissions()).map((p) => p.name)).toHaveLength(3)
  })

  it('warns from createPermission() against stored names, both ways', async () => {
    const rbac = make()
    await rbac.createPermission('orders.refund.large')
    expect(warn).not.toHaveBeenCalled()
    await rbac.createPermission('orders.refund')
    expect(warn).toHaveBeenCalledTimes(1)
    await rbac.createPermission('orders.refund.large.eu')
    expect(warn).toHaveBeenCalledTimes(3) // orders.refund → .eu, orders.refund.large → .eu
  })

  it('checks names referenced by roles and stored ones, per guard', async () => {
    const rbac = make()
    await rbac.createPermission('orders.refund', { guard: 'api' }) // other guard: no conflict
    await rbac.createPermission('orders')
    expect(warn).not.toHaveBeenCalled()
    await rbac.sync({ roles: { lead: ['orders.refund.large'] } })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain('`orders` also grants `orders.refund.large` (guard `web`)')
  })

  it('reports nothing for names that will be pruned', async () => {
    const rbac = make({ wildcardPrefixCheck: 'error' })
    await rbac.createPermission('orders.refund')
    const result = await rbac.sync({ permissions: ['orders.refund.large'] }, { prune: true })
    expect(result.deleted.permissions).toEqual([{ name: 'orders.refund', guard: 'web' }])
    expect((await rbac.getPermissions()).map((p) => p.name)).toEqual(['orders.refund.large'])
  })

  it("'error' throws before anything is written, also in a dry run", async () => {
    const rbac = make({ wildcardPrefixCheck: 'error' })
    const definition = { permissions: ['orders.refund', 'orders.refund.large'] }
    await expect(rbac.sync(definition, { dryRun: true })).rejects.toMatchObject({ code: 'INVALID_WILDCARD_PERMISSION' })
    await expect(rbac.sync(definition)).rejects.toBeInstanceOf(RbacError)
    expect(await rbac.getPermissions()).toEqual([])

    await rbac.createPermission('orders.refund')
    await expect(rbac.createPermission('orders.refund.large')).rejects.toMatchObject({
      code: 'INVALID_WILDCARD_PERMISSION',
      message: expect.stringContaining('`orders.refund` also grants `orders.refund.large`'),
    })
    expect((await rbac.getPermissions()).map((p) => p.name)).toEqual(['orders.refund'])
  })

  it("'error' applies outside development too", async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rbac = make({ wildcardPrefixCheck: 'error' })
    await expect(rbac.sync({ permissions: ['a', 'a.b'] })).rejects.toBeInstanceOf(RbacError)
  })

  it("'off' and production stay silent", async () => {
    await make({ wildcardPrefixCheck: 'off' }).sync({ permissions: ['a', 'a.b'] })
    await make({ wildcardPrefixCheck: 'off' }).createPermission('a').then(() => {})
    vi.stubEnv('NODE_ENV', 'production')
    const rbac = make()
    await rbac.sync({ permissions: ['b', 'b.c'] })
    await rbac.createPermission('b.c.d')
    expect(warn).not.toHaveBeenCalled()
  })

  it('does nothing without wildcards', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), wildcardPrefixCheck: 'error' })
    await rbac.sync({ permissions: ['orders.refund', 'orders.refund.large'] })
    await rbac.createPermission('orders')
    expect(warn).not.toHaveBeenCalled()
  })

  it('is silent when `process` does not exist (edge runtimes)', async () => {
    const original = globalThis.process
    // @ts-expect-error simulate a runtime without `process`
    delete globalThis.process
    try {
      await make().sync({ permissions: ['e', 'e.f'] })
    } finally {
      globalThis.process = original
    }
    expect(warn).not.toHaveBeenCalled()
  })
})
