import { beforeEach, describe, expect, it } from 'vitest'
import {
  createRbac,
  GuardDoesNotMatch,
  MemoryAdapter,
  PermissionAlreadyExists,
  PermissionDoesNotExist,
  type Rbac,
  RbacError,
  RoleAlreadyExists,
  RoleDoesNotExist,
} from '../src'

const alice = { type: 'user', id: 1 }
const bob = { type: 'user', id: 2 }

describe('permissions & roles', () => {
  let rbac: Rbac

  beforeEach(async () => {
    rbac = createRbac({ adapter: new MemoryAdapter() })
    await rbac.createPermission('edit articles')
    await rbac.createPermission('delete articles')
    await rbac.createPermission('publish articles')
    await rbac.createRole('writer')
    await rbac.createRole('editor')
  })

  it('creates, finds and lists permissions and roles', async () => {
    expect((await rbac.findPermission('edit articles'))?.name).toBe('edit articles')
    expect(await rbac.findPermission('nope')).toBeNull()
    expect((await rbac.getPermissions()).map((p) => p.name)).toHaveLength(3)
    expect((await rbac.findRoleOrFail('writer')).guardName).toBe('web')
    await expect(rbac.findRoleOrFail('nope')).rejects.toBeInstanceOf(RoleDoesNotExist)
  })

  it('rejects duplicates', async () => {
    await expect(rbac.createPermission('edit articles')).rejects.toBeInstanceOf(PermissionAlreadyExists)
    await expect(rbac.createRole('writer')).rejects.toBeInstanceOf(RoleAlreadyExists)
  })

  it('findOrCreate is idempotent', async () => {
    const a = await rbac.findOrCreatePermission('comment')
    const b = await rbac.findOrCreatePermission('comment')
    expect(a.id).toBe(b.id)
  })

  it('grants permissions through roles', async () => {
    await rbac.role('writer').givePermissionTo('edit articles', 'delete articles')
    const user = rbac.for(alice)
    await user.assignRole('writer')

    expect(await user.hasRole('writer')).toBe(true)
    expect(await user.hasPermissionTo('edit articles')).toBe(true)
    expect(await user.can('publish articles')).toBe(false)
    expect(await user.getRoleNames()).toEqual(['writer'])
    expect((await user.getPermissionsViaRoles()).map((p) => p.name).sort()).toEqual([
      'delete articles',
      'edit articles',
    ])
    expect(await user.hasDirectPermission('edit articles')).toBe(false)
  })

  it('grants direct permissions', async () => {
    const user = rbac.for(alice)
    await user.givePermissionTo(['publish articles'])
    expect(await user.hasDirectPermission('publish articles')).toBe(true)
    expect(await user.can('publish articles')).toBe(true)

    await user.revokePermissionTo('publish articles')
    expect(await user.can('publish articles')).toBe(false)
  })

  it('keeps subjects isolated', async () => {
    await rbac.for(alice).assignRole('writer')
    expect(await rbac.for(bob).hasRole('writer')).toBe(false)
  })

  it('removes and syncs roles', async () => {
    const user = rbac.for(alice)
    await user.assignRole('writer', 'editor')
    expect(await user.hasAllRoles('writer', 'editor')).toBe(true)

    await user.removeRole('writer')
    expect(await user.getRoleNames()).toEqual(['editor'])

    await user.syncRoles(['writer'])
    expect(await user.getRoleNames()).toEqual(['writer'])
    expect(await user.hasAnyRole('editor', 'writer')).toBe(true)
    expect(await user.hasAllRoles('editor', 'writer')).toBe(false)
    expect(await user.hasRole(['editor', 'admin'])).toBe(false)
  })

  it('syncs role permissions', async () => {
    const writer = rbac.role('writer')
    await writer.givePermissionTo('edit articles', 'delete articles')
    await writer.syncPermissions('publish articles')
    expect(await writer.getPermissionNames()).toEqual(['publish articles'])
    expect(await writer.hasPermissionTo('publish articles')).toBe(true)
  })

  it('hasPermissionTo throws on unknown permission, can() returns false', async () => {
    const user = rbac.for(alice)
    await expect(user.hasPermissionTo('fly')).rejects.toBeInstanceOf(PermissionDoesNotExist)
    expect(await user.can('fly')).toBe(false)
    expect(await user.cannot('fly')).toBe(true)
  })

  it('throws when assigning unknown roles or permissions', async () => {
    await expect(rbac.for(alice).assignRole('admin')).rejects.toBeInstanceOf(RoleDoesNotExist)
    await expect(rbac.role('writer').givePermissionTo('fly')).rejects.toBeInstanceOf(PermissionDoesNotExist)
  })

  it('canAny / canAll', async () => {
    const user = rbac.for(alice)
    await user.givePermissionTo('edit articles')
    expect(await user.canAny('publish articles', 'edit articles')).toBe(true)
    expect(await user.canAll('publish articles', 'edit articles')).toBe(false)
    expect(await user.hasAnyPermission(['edit articles'])).toBe(true)
  })

  it('invalidates the cache after changes', async () => {
    const user = rbac.for(alice)
    await user.assignRole('writer')
    expect(await user.can('edit articles')).toBe(false) // populates cache
    await rbac.role('writer').givePermissionTo('edit articles')
    expect(await user.can('edit articles')).toBe(true)
  })

  it('deleting a role or permission removes it from subjects', async () => {
    const user = rbac.for(alice)
    await rbac.role('writer').givePermissionTo('edit articles')
    await user.assignRole('writer')
    await user.givePermissionTo('publish articles')

    await rbac.deleteRole('writer')
    await rbac.deletePermission('publish articles')

    expect(await user.getRoleNames()).toEqual([])
    expect(await user.getPermissionNames()).toEqual([])
  })

  it('returns a serializable snapshot', async () => {
    const user = rbac.for(alice)
    await rbac.role('writer').givePermissionTo('edit articles')
    await user.assignRole('writer')
    await user.givePermissionTo('publish articles')

    const snapshot = await user.snapshot()
    expect(snapshot.roles).toEqual(['writer'])
    expect(snapshot.permissions.sort()).toEqual(['edit articles', 'publish articles'])
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('works without cache', async () => {
    const noCache = createRbac({ adapter: new MemoryAdapter(), cache: false })
    await noCache.createPermission('x')
    await noCache.for(alice).givePermissionTo('x')
    expect(await noCache.for(alice).can('x')).toBe(true)
  })
})

describe('guards', () => {
  let rbac: Rbac

  beforeEach(async () => {
    rbac = createRbac({ adapter: new MemoryAdapter() })
    await rbac.createPermission('edit articles')
    await rbac.createPermission('edit articles', { guard: 'api' })
    await rbac.createRole('writer', { guard: 'api' })
  })

  it('isolates permissions per guard', async () => {
    await rbac.for(alice, { guard: 'api' }).givePermissionTo('edit articles')
    expect(await rbac.for(alice, { guard: 'api' }).can('edit articles')).toBe(true)
    expect(await rbac.for(alice).can('edit articles')).toBe(false)
  })

  it('rejects objects from another guard', async () => {
    const apiRole = await rbac.findRoleOrFail('writer', { guard: 'api' })
    await expect(rbac.for(alice).assignRole(apiRole)).rejects.toBeInstanceOf(GuardDoesNotMatch)

    const webPermission = await rbac.findPermissionOrFail('edit articles')
    await expect(rbac.role(apiRole).givePermissionTo(webPermission)).rejects.toBeInstanceOf(GuardDoesNotMatch)
  })

  it('supports a custom default guard', async () => {
    const api = createRbac({ adapter: new MemoryAdapter(), defaultGuard: 'api' })
    expect((await api.createPermission('x')).guardName).toBe('api')
  })
})

describe('wildcard permissions', () => {
  let rbac: Rbac

  beforeEach(async () => {
    rbac = createRbac({ adapter: new MemoryAdapter(), wildcard: true })
    await rbac.createPermission('articles.*')
    await rbac.createPermission('posts.edit,delete')
  })

  it('matches wildcard patterns', async () => {
    const user = rbac.for(alice)
    await user.givePermissionTo('articles.*', 'posts.edit,delete')

    expect(await user.can('articles.edit')).toBe(true)
    expect(await user.can('articles.edit.own')).toBe(true)
    expect(await user.can('posts.delete')).toBe(true)
    expect(await user.can('posts.create')).toBe(false)
    expect(await user.can('comments.edit')).toBe(false)
  })

  it('does not throw for unknown permissions', async () => {
    expect(await rbac.for(alice).hasPermissionTo('anything.here')).toBe(false)
  })

  it('validates wildcard syntax on create', async () => {
    await expect(rbac.createPermission('articles..edit')).rejects.toBeInstanceOf(RbacError)
  })
})

describe('teams', () => {
  let rbac: Rbac

  beforeEach(async () => {
    rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await rbac.createPermission('manage billing')
    await rbac.createRole('admin') // global role
    await rbac.createRole('manager', { team: 1 }) // team-specific role
    await rbac.role('admin').givePermissionTo('manage billing')
  })

  it('scopes role assignments per team', async () => {
    await rbac.for(alice, { team: 1 }).assignRole('admin')

    expect(await rbac.for(alice, { team: 1 }).hasRole('admin')).toBe(true)
    expect(await rbac.for(alice, { team: 1 }).can('manage billing')).toBe(true)
    expect(await rbac.for(alice, { team: 2 }).hasRole('admin')).toBe(false)
    expect(await rbac.for(alice, { team: 2 }).can('manage billing')).toBe(false)
  })

  it('team-specific roles are only visible in their team', async () => {
    await rbac.for(alice, { team: 1 }).assignRole('manager')
    await expect(rbac.for(alice, { team: 2 }).assignRole('manager')).rejects.toBeInstanceOf(RoleDoesNotExist)

    const manager = await rbac.findRoleOrFail('manager', { team: 1 })
    await expect(rbac.for(alice, { team: 2 }).assignRole(manager)).rejects.toMatchObject({
      code: 'TEAM_DOES_NOT_MATCH',
    })
  })

  it('team-specific role wins over a global role with the same name', async () => {
    const teamAdmin = await rbac.createRole('admin', { team: 1 })
    expect((await rbac.findRoleOrFail('admin', { team: 1 })).id).toBe(teamAdmin.id)
    expect((await rbac.findRoleOrFail('admin', { team: 2 })).teamId).toBeNull()
  })

  it('throws when a team is given but teams are disabled', () => {
    const plain = createRbac({ adapter: new MemoryAdapter() })
    expect(() => plain.for(alice, { team: 1 })).toThrowError(expect.objectContaining({ code: 'TEAMS_NOT_ENABLED' }))
  })
})

describe('public surface', () => {
  const INTERNAL = [
    'events',
    'gate',
    'permissionExists',
    'permissionMatches',
    'remember',
    'resolveGuard',
    'resolvePermissions',
    'resolveRoles',
    'resolveTeam',
    'visibleTeams',
  ]

  it('keeps the engine internals out of reach on Rbac, RoleRbac and SubjectRbac', () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    const objects: object[] = [rbac, rbac.role('writer'), rbac.for(alice)]
    for (const object of objects) {
      for (const name of INTERNAL) expect(name in object, `${object.constructor.name}.${name}`).toBe(false)
    }
  })

  it('still runs internals for each instance separately', async () => {
    const a = createRbac({ adapter: new MemoryAdapter(), superAdminRoles: ['admin'] })
    const b = createRbac({ adapter: new MemoryAdapter() })
    for (const rbac of [a, b]) {
      await rbac.createPermission('edit')
      await rbac.createRole('admin')
      await rbac.for(alice).assignRole('admin')
    }
    expect(await a.for(alice).can('edit')).toBe(true)
    expect(await b.for(alice).can('edit')).toBe(false)
  })
})

describe('options set to undefined', () => {
  it('behave like options left out', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), defaultGuard: undefined, cache: undefined, wildcard: undefined })
    await rbac.createPermission('edit', { guard: undefined })
    await rbac.createRole('writer', { guard: undefined, team: undefined })
    await rbac.role('writer', { guard: undefined, team: undefined }).givePermissionTo('edit')
    await rbac.for(alice, { guard: undefined, team: undefined }).assignRole('writer')
    expect(await rbac.for(alice).can('edit')).toBe(true)
    expect(await rbac.for(alice, { guard: undefined }).can('edit')).toBe(true)
    expect((await rbac.sync({ guard: undefined, permissions: ['edit'] }, { dryRun: undefined })).dryRun).toBe(false)
  })
})
