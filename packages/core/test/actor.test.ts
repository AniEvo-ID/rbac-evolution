import { describe, expect, it, vi } from 'vitest'
import { createRbac, MemoryAdapter, type RbacActor, type RbacEvent, type RbacEventName } from '../src'

const admin = { type: 'user', id: 99 }
const alice = { type: 'user', id: 1 }

const ALL: RbacEventName[] = [
  'role.attached',
  'role.detached',
  'permission.attached',
  'permission.detached',
  'role.created',
  'role.deleted',
  'permission.created',
  'permission.deleted',
]

function record(rbac: ReturnType<typeof createRbac>): RbacEvent[] {
  const events: RbacEvent[] = []
  for (const name of ALL) rbac.on(name, (e) => void events.push(e))
  return events
}

const actors = (events: RbacEvent[]) => events.map((e) => [e.event, e.actor])

describe('actor in events', () => {
  it('has no `actor` field by default (unchanged payloads)', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    const events = record(rbac)
    await rbac.createPermission('edit')
    await rbac.createRole('writer')
    await rbac.for(alice).assignRole('writer')
    expect(events).toHaveLength(3)
    for (const e of events) expect('actor' in e).toBe(false)
  })

  it('stamps the actor given to each write call', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    const events = record(rbac)
    await rbac.createPermission('edit', { actor: admin })
    await rbac.findOrCreatePermission('delete', { actor: 'seed' })
    await rbac.createRole('writer', { actor: admin })
    await rbac.findOrCreateRole('editor', { actor: 'seed' })
    await rbac.role('writer', { actor: 'cli' }).givePermissionTo('edit')
    await rbac.role('writer', { actor: 'cli' }).revokePermissionTo('edit')
    await rbac.role('writer', { actor: 'cli' }).syncPermissions('delete')
    const user = rbac.for(alice, { actor: admin })
    await user.assignRole('writer')
    await user.removeRole('writer')
    await user.syncRoles('editor')
    await user.givePermissionTo('edit')
    await user.revokePermissionTo('edit')
    await user.syncPermissions('delete')
    await rbac.deleteRole('editor', { actor: admin })
    await rbac.deletePermission('edit', { actor: admin })

    expect(actors(events)).toEqual([
      ['permission.created', admin],
      ['permission.created', 'seed'],
      ['role.created', admin],
      ['role.created', 'seed'],
      ['permission.attached', 'cli'],
      ['permission.detached', 'cli'],
      ['permission.attached', 'cli'],
      ['role.attached', admin],
      ['role.detached', admin],
      ['role.attached', admin],
      ['permission.attached', admin],
      ['permission.detached', admin],
      ['permission.attached', admin],
      ['role.deleted', admin],
      ['permission.deleted', admin],
    ])
  })

  it('keeps the actor across withScope() and Role objects', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    const role = await rbac.createRole('writer', { team: 1 })
    const events = record(rbac)
    await rbac.for(alice, { actor: admin }).withScope({ team: 1 }).assignRole('writer')
    await rbac.createPermission('edit')
    await rbac.role(role, { actor: 'cli' }).givePermissionTo('edit')
    expect(actors(events)).toEqual([
      ['role.attached', admin],
      ['permission.created', undefined],
      ['permission.attached', 'cli'],
    ])
  })

  it('uses getActor() when a call passes none, and only when there are listeners', async () => {
    let current: RbacActor | null = admin
    const getActor = vi.fn(async () => current)
    const rbac = createRbac({ adapter: new MemoryAdapter(), getActor })
    await rbac.createPermission('quiet') // no listener yet
    expect(getActor).not.toHaveBeenCalled()

    const events = record(rbac)
    await rbac.createPermission('edit')
    await rbac.createPermission('delete', { actor: 'cli' }) // explicit wins
    current = null
    await rbac.createRole('writer') // null: no actor
    expect(actors(events)).toEqual([
      ['permission.created', admin],
      ['permission.created', 'cli'],
      ['role.created', undefined],
    ])
    expect('actor' in events[2]!).toBe(false)
    expect(getActor).toHaveBeenCalledTimes(2)
  })

  it('passes the actor through sync(), to every write', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await rbac.sync({ permissions: ['old'], roles: { stale: ['old'] } })
    const events = record(rbac)
    await rbac.sync({ permissions: ['edit'], roles: { writer: ['edit'] } }, { prune: true, actor: 'deploy' })
    expect(events.map((e) => e.event)).toEqual([
      'permission.created',
      'role.created',
      'permission.attached',
      'role.deleted',
      'permission.deleted',
    ])
    expect(events.every((e) => e.actor === 'deploy')).toBe(true)
  })

  it('passes the actor through role.syncSubjects()', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await rbac.createRole('writer')
    await rbac.for(alice).assignRole('writer')
    const events = record(rbac)
    await rbac.role('writer', { actor: admin }).syncSubjects('user', [2])
    expect(actors(events)).toEqual([
      ['role.attached', admin],
      ['role.detached', admin],
    ])
  })
})
