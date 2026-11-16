import { describe, expect, it, vi } from 'vitest'
import { createRbac, MemoryAdapter } from '../src'

const boss = { type: 'user', id: 1 }
const agent = { type: 'user', id: 2 }

async function setup() {
  const before = vi.fn(({ permission }: { permission: string }) =>
    permission === 'audit-log.delete' ? false : permission === 'status.view' ? true : undefined,
  )
  const rbac = createRbac({ adapter: new MemoryAdapter(), superAdminRoles: ['super-admin'], before })
  await rbac.sync({ permissions: ['audit-log.delete', 'audit-log.view'], roles: { 'super-admin': [], agent: ['audit-log.view'] } })
  await rbac.for(boss).assignRole('super-admin')
  await rbac.for(agent).assignRole('agent')
  return { rbac, before }
}

describe('snapshot({ checkBefore })', () => {
  it('has no `denied` without the option (unchanged shape)', async () => {
    const { rbac, before } = await setup()
    expect(await rbac.for(boss).snapshot()).toEqual({ roles: ['super-admin'], permissions: [] })
    expect(before).not.toHaveBeenCalled()
  })

  it('lists the names the before hook denies, even to a super-admin', async () => {
    const { rbac } = await setup()
    const snapshot = await rbac.for(boss).snapshot({ checkBefore: ['audit-log.delete', 'audit-log.view', 'status.view'] })
    expect(snapshot).toEqual({ roles: ['super-admin'], permissions: [], denied: ['audit-log.delete'] })
    expect(await rbac.for(boss).can('audit-log.delete')).toBe(false)
    expect(await rbac.for(boss).can('audit-log.view')).toBe(true)
  })

  it('gives an empty list when nothing is denied, trims and de-duplicates names', async () => {
    const { rbac, before } = await setup()
    expect((await rbac.for(agent).snapshot({ checkBefore: ['audit-log.view'] })).denied).toEqual([])
    expect((await rbac.for(agent).snapshot({ checkBefore: [] })).denied).toEqual([])
    before.mockClear()
    const snapshot = await rbac.for(agent).snapshot({ checkBefore: [' audit-log.delete ', 'audit-log.delete', ' '] })
    expect(snapshot.denied).toEqual(['audit-log.delete'])
    expect(before).toHaveBeenCalledTimes(1)
  })

  it('passes the scoped subject to the hook', async () => {
    const seen: string[] = []
    const rbac = createRbac({
      adapter: new MemoryAdapter(),
      before: ({ subject, permission }) => {
        seen.push(`${subject.subject.id}:${subject.guardName}:${permission}`)
        return subject.subject.id === 2 ? false : undefined
      },
    })
    expect((await rbac.for(boss, { guard: 'api' }).snapshot({ checkBefore: ['x'] })).denied).toEqual([])
    expect((await rbac.for(agent).snapshot({ checkBefore: ['x'] })).denied).toEqual(['x'])
    expect(seen).toEqual(['1:api:x', '2:web:x'])
  })

  it('without a before hook, nothing is denied', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), superAdminRoles: ['root'] })
    expect(await rbac.for(boss).snapshot({ checkBefore: ['anything'] })).toEqual({ roles: [], permissions: [], denied: [] })
  })
})
