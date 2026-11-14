import { beforeEach, describe, expect, it } from 'vitest'
import {
  createRbac,
  MemoryAdapter,
  PermissionDoesNotExist,
  type Rbac,
  type RbacEvent,
  RoleDoesNotExist,
} from '../src'

const alice = { type: 'user', id: 1 }
const bob = { type: 'user', id: 2 }
const carol = { type: 'user', id: 3 }
const robot = { type: 'client', id: 1 }

async function seed(rbac: Rbac): Promise<void> {
  await rbac.createPermission('edit articles')
  await rbac.createPermission('delete articles')
  await rbac.createPermission('publish articles')
  await rbac.createRole('writer')
  await rbac.createRole('editor')
  await rbac.createRole('super-admin')
}

describe('super-admin', () => {
  it('superAdminRoles pass every can() check, even unknown permissions', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), superAdminRoles: ['super-admin'] })
    await seed(rbac)
    const root = rbac.for(alice)
    await root.assignRole('super-admin')

    expect(await root.can('edit articles')).toBe(true)
    expect(await root.can('fly')).toBe(true)
    expect(await root.cannot('delete articles')).toBe(false)
    expect(await root.canAll('edit articles', 'publish articles')).toBe(true)
    expect(await root.canAny(['delete articles'])).toBe(true)
    expect(await rbac.for(bob).can('edit articles')).toBe(false)
  })

  it('does not affect hasPermissionTo & co. (pure data checks)', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), superAdminRoles: ['super-admin'] })
    await seed(rbac)
    const root = rbac.for(alice)
    await root.assignRole('super-admin')

    expect(await root.hasPermissionTo('edit articles')).toBe(false)
    expect(await root.hasDirectPermission('edit articles')).toBe(false)
    expect(await root.hasAnyPermission('edit articles')).toBe(false)
    expect(await root.hasAllPermissions('edit articles')).toBe(false)
    await expect(root.hasPermissionTo('fly')).rejects.toBeInstanceOf(PermissionDoesNotExist)
  })

  it('before hook can allow, deny or fall through', async () => {
    const calls: string[] = []
    const rbac = createRbac({
      adapter: new MemoryAdapter(),
      superAdminRoles: ['super-admin'],
      before: async ({ subject, permission }) => {
        calls.push(`${String(subject.subject.id)}:${permission}`)
        if (permission === 'delete articles') return false // nobody, not even super-admins
        if (subject.subject.id === 2) return true
        return undefined
      },
    })
    await seed(rbac)
    await rbac.for(alice).assignRole('super-admin')
    await rbac.for(carol).givePermissionTo('edit articles')

    expect(await rbac.for(alice).can('delete articles')).toBe(false)
    expect(await rbac.for(alice).can('edit articles')).toBe(true) // super-admin
    expect(await rbac.for(bob).can('publish articles')).toBe(true) // before → true
    expect(await rbac.for(carol).can('edit articles')).toBe(true) // normal check
    expect(await rbac.for(carol).can('publish articles')).toBe(false)
    expect(calls).toContain('1:delete articles')
    expect(calls).toContain('3:publish articles')
  })

  it('before receives a scoped subject (team aware)', async () => {
    const rbac = createRbac({
      adapter: new MemoryAdapter(),
      teams: true,
      before: ({ subject }) => (subject.teamId === 99 ? true : undefined),
    })
    await rbac.createPermission('manage billing')
    expect(await rbac.for(alice, { team: 99 }).can('manage billing')).toBe(true)
    expect(await rbac.for(alice, { team: 1 }).can('manage billing')).toBe(false)
  })

  it('super-admin roles are team scoped', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true, superAdminRoles: ['owner'] })
    await rbac.createPermission('manage billing')
    await rbac.createRole('owner')
    await rbac.for(alice, { team: 1 }).assignRole('owner')
    expect(await rbac.for(alice, { team: 1 }).can('manage billing')).toBe(true)
    expect(await rbac.for(alice, { team: 2 }).can('manage billing')).toBe(false)
  })
})

describe('events', () => {
  let rbac: Rbac
  let log: RbacEvent[]

  beforeEach(async () => {
    rbac = createRbac({ adapter: new MemoryAdapter() })
    await seed(rbac)
    log = []
    const push = (e: RbacEvent): void => {
      log.push(e)
    }
    rbac.on('role.attached', push)
    rbac.on('role.detached', push)
    rbac.on('permission.attached', push)
    rbac.on('permission.detached', push)
    rbac.on('role.created', push)
    rbac.on('role.deleted', push)
    rbac.on('permission.created', push)
    rbac.on('permission.deleted', push)
  })

  const summary = (): string[] =>
    log.map((e) => {
      switch (e.event) {
        case 'role.attached':
        case 'role.detached':
          return `${e.event} ${String(e.subject.id)} ${e.roles.map((r) => r.name).join(',')}`
        case 'permission.attached':
        case 'permission.detached': {
          const owner = e.target === 'role' ? `role:${e.role.name}` : `subject:${String(e.subject.id)}`
          return `${e.event} ${owner} ${e.permissions.map((p) => p.name).join(',')}`
        }
        case 'role.created':
        case 'role.deleted':
          return `${e.event} ${e.role.name}`
        case 'permission.created':
        case 'permission.deleted':
          return `${e.event} ${e.permission.name}`
      }
    })

  it('emits created / deleted events', async () => {
    await rbac.createPermission('comment')
    await rbac.createRole('moderator')
    await rbac.findOrCreateRole('moderator') // exists → no event
    await rbac.deleteRole('moderator')
    await rbac.deletePermission('comment')
    expect(summary()).toEqual([
      'permission.created comment',
      'role.created moderator',
      'role.deleted moderator',
      'permission.deleted comment',
    ])
  })

  it('emits subject role events with only the actual changes', async () => {
    const user = rbac.for(alice)
    await user.assignRole('writer')
    await user.assignRole('writer', 'editor') // writer already attached
    await user.removeRole('editor', 'super-admin') // super-admin was not attached
    await user.removeRole('editor') // nothing to remove → no event
    expect(summary()).toEqual(['role.attached 1 writer', 'role.attached 1 editor', 'role.detached 1 editor'])
  })

  it('syncRoles emits detached for removed and attached for added', async () => {
    const user = rbac.for(alice)
    await user.assignRole('writer', 'editor')
    log.length = 0
    await user.syncRoles('editor', 'super-admin')
    expect(summary()).toEqual(['role.detached 1 writer', 'role.attached 1 super-admin'])
    log.length = 0
    await user.syncRoles('editor', 'super-admin')
    expect(log).toEqual([])
  })

  it('emits permission events for subjects', async () => {
    const user = rbac.for(alice)
    await user.givePermissionTo('edit articles', 'delete articles')
    await user.givePermissionTo('edit articles') // no change
    await user.revokePermissionTo('delete articles', 'publish articles')
    await user.syncPermissions('publish articles', 'edit articles')
    expect(summary()).toEqual([
      'permission.attached subject:1 edit articles,delete articles',
      'permission.detached subject:1 delete articles',
      'permission.attached subject:1 publish articles',
    ])
    const first = log[0]
    expect(first).toMatchObject({ target: 'subject', subject: alice, guardName: 'web', teamId: null })
  })

  it('emits permission events for roles', async () => {
    const writer = rbac.role('writer')
    await writer.givePermissionTo('edit articles')
    await writer.givePermissionTo('edit articles', 'delete articles')
    await writer.revokePermissionTo('publish articles') // not attached → no event
    await writer.syncPermissions('publish articles', 'edit articles')
    expect(summary()).toEqual([
      'permission.attached role:writer edit articles',
      'permission.attached role:writer delete articles',
      'permission.detached role:writer delete articles',
      'permission.attached role:writer publish articles',
    ])
    expect(log[0]).toMatchObject({ target: 'role', role: { name: 'writer' }, teamId: null })
  })

  it('awaits async listeners in registration order, after the write', async () => {
    const order: string[] = []
    const fresh = createRbac({ adapter: new MemoryAdapter() })
    await fresh.createRole('writer')
    fresh.on('role.attached', async ({ subject }) => {
      await new Promise((r) => setTimeout(r, 10))
      order.push(`first:${String(await fresh.for(subject).hasRole('writer'))}`)
    })
    fresh.on('role.attached', () => {
      order.push('second')
    })
    await fresh.for(alice).assignRole('writer')
    expect(order).toEqual(['first:true', 'second'])
  })

  it('does not emit when the write fails', async () => {
    await expect(rbac.for(alice).assignRole('nope')).rejects.toBeInstanceOf(RoleDoesNotExist)
    await expect(rbac.createRole('writer')).rejects.toBeTruthy()
    expect(log).toEqual([])
  })

  it('on() returns an unsubscribe function, off() removes a listener', async () => {
    const seen: string[] = []
    const listener = (): void => {
      seen.push('x')
    }
    const unsubscribe = rbac.on('permission.created', listener)
    await rbac.createPermission('a')
    unsubscribe()
    await rbac.createPermission('b')
    rbac.on('permission.created', listener)
    rbac.off('permission.created', listener)
    await rbac.createPermission('c')
    expect(seen).toEqual(['x'])
  })

  it('includes the team id', async () => {
    const teams = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await teams.createRole('admin')
    const events: RbacEvent[] = []
    teams.on('role.attached', (e) => {
      events.push(e)
    })
    await teams.for(alice, { team: 7 }).assignRole('admin')
    expect(events[0]).toMatchObject({ event: 'role.attached', teamId: 7, roles: [{ name: 'admin' }] })
  })
})

describe('queries', () => {
  let rbac: Rbac

  beforeEach(async () => {
    rbac = createRbac({ adapter: new MemoryAdapter() })
    await seed(rbac)
    await rbac.role('writer').givePermissionTo('edit articles')
    await rbac.role('editor').givePermissionTo('edit articles', 'publish articles')
  })

  it('hasExactRoles', async () => {
    const user = rbac.for(alice)
    expect(await user.hasExactRoles()).toBe(true)
    await user.assignRole('writer', 'editor')
    expect(await user.hasExactRoles('writer', 'editor')).toBe(true)
    expect(await user.hasExactRoles(['editor', 'writer', 'writer'])).toBe(true)
    expect(await user.hasExactRoles('writer')).toBe(false)
    expect(await user.hasExactRoles('writer', 'editor', 'super-admin')).toBe(false)
    const writer = await rbac.findRoleOrFail('writer')
    expect(await user.hasExactRoles(writer, 'editor')).toBe(true)
  })

  it('subjectsWithRole', async () => {
    await rbac.for(alice).assignRole('writer')
    await rbac.for(bob).assignRole('editor')
    await rbac.for(robot).assignRole('writer')

    expect(await rbac.subjectsWithRole('user', 'writer')).toEqual([1])
    expect((await rbac.subjectsWithRole('user', ['writer', 'editor'])).sort()).toEqual([1, 2])
    expect(await rbac.subjectsWithRole('client', 'writer')).toEqual([1])
    expect(await rbac.subjectsWithRole('user', 'super-admin')).toEqual([])
    await expect(rbac.subjectsWithRole('user', 'nope')).rejects.toBeInstanceOf(RoleDoesNotExist)
  })

  it('subjectsWithPermission includes direct and via-role grants', async () => {
    await rbac.for(alice).assignRole('writer') // edit via role
    await rbac.for(bob).givePermissionTo('edit articles') // edit directly
    await rbac.for(bob).assignRole('writer') // and via role (no duplicate)
    await rbac.for(carol).assignRole('editor') // edit + publish via role
    await rbac.for(robot).givePermissionTo('edit articles')

    expect((await rbac.subjectsWithPermission('user', 'edit articles')).sort()).toEqual([1, 2, 3])
    expect(await rbac.subjectsWithPermission('user', 'publish articles')).toEqual([3])
    expect(await rbac.subjectsWithPermission('user', 'delete articles')).toEqual([])
    expect(await rbac.subjectsWithPermission('client', ['edit articles'])).toEqual([1])
    await expect(rbac.subjectsWithPermission('user', 'fly')).rejects.toBeInstanceOf(PermissionDoesNotExist)
  })

  it('queries respect teams', async () => {
    const teams = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await teams.createPermission('manage billing')
    await teams.createRole('admin')
    await teams.role('admin').givePermissionTo('manage billing')
    await teams.for(alice, { team: 1 }).assignRole('admin')
    await teams.for(bob, { team: 2 }).givePermissionTo('manage billing')

    expect(await teams.subjectsWithRole('user', 'admin', { team: 1 })).toEqual([1])
    expect(await teams.subjectsWithRole('user', 'admin', { team: 2 })).toEqual([])
    expect(await teams.subjectsWithPermission('user', 'manage billing', { team: 1 })).toEqual([1])
    expect(await teams.subjectsWithPermission('user', 'manage billing', { team: 2 })).toEqual([2])
  })
})

describe('permission existence check', () => {
  it('is cached between can() calls and refreshed after changes', async () => {
    const adapter = new MemoryAdapter()
    let lookups = 0
    const original = adapter.findPermissions.bind(adapter)
    adapter.findPermissions = async (query) => {
      if (query?.ids === undefined) lookups++
      return original(query)
    }
    const rbac = createRbac({ adapter })
    await rbac.createPermission('edit articles')
    const user = rbac.for({ type: 'user', id: 1 })
    await user.givePermissionTo('edit articles')

    lookups = 0
    for (let i = 0; i < 5; i++) expect(await user.can('edit articles')).toBe(true)
    expect(lookups).toBe(1)

    await rbac.createPermission('publish articles')
    expect(await user.can('publish articles')).toBe(false)
    expect(await user.hasPermissionTo('edit articles')).toBe(true)
    await expect(user.hasPermissionTo('nope')).rejects.toThrow('There is no permission named `nope`')
  })
})

describe('role.syncSubjects (spatie Role::syncModels)', () => {
  it('makes the given subjects the only holders of the role, per subject type, with events', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), cache: false })
    await seed(rbac)
    await rbac.for(alice).assignRole('writer')
    await rbac.for(bob).assignRole('writer')
    await rbac.for(robot).assignRole('writer')
    const events: string[] = []
    rbac.on('role.attached', (e) => void events.push(`+${String(e.subject.id)}`))
    rbac.on('role.detached', (e) => void events.push(`-${String(e.subject.id)}`))

    await rbac.role('writer').syncSubjects('user', [2, 3])

    expect((await rbac.subjectsWithRole('user', 'writer')).map(String).sort()).toEqual(['2', '3'])
    expect(await rbac.subjectsWithRole('client', 'writer')).toHaveLength(1)
    expect(events).toEqual(['+3', '-1'])

    await rbac.role('writer').syncSubjects('user', [])
    expect(await rbac.subjectsWithRole('user', 'writer')).toHaveLength(0)
    expect(await rbac.for(carol).hasRole('writer')).toBe(false)
  })
})
