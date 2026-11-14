import { beforeEach, describe, expect, it } from 'vitest'
import { createRbac, MemoryAdapter, type Rbac, type RbacEvent, RbacError, type SyncDefinition } from '../src'

const seed: SyncDefinition = {
  permissions: ['edit articles', 'delete articles', 'publish articles'],
  roles: {
    admin: '*',
    writer: ['edit articles'],
  },
}

const sorted = (names: string[]): string[] => [...names].sort()

describe('rbac.sync', () => {
  let rbac: Rbac

  beforeEach(() => {
    rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
  })

  it('creates permissions and roles and gives roles their permissions', async () => {
    const result = await rbac.sync(seed)

    expect(result.dryRun).toBe(false)
    expect(result.created.permissions.map((p) => p.name)).toEqual(['edit articles', 'delete articles', 'publish articles'])
    expect(result.created.roles).toEqual([
      { name: 'admin', guard: 'web', team: null, permissions: ['edit articles', 'delete articles', 'publish articles'] },
      { name: 'writer', guard: 'web', team: null, permissions: ['edit articles'] },
    ])
    expect(result.updated.roles).toEqual([])
    expect(result.deleted).toEqual({ permissions: [], roles: [] })

    expect(sorted(await rbac.role('admin').getPermissionNames())).toEqual([
      'delete articles',
      'edit articles',
      'publish articles',
    ])
    expect(await rbac.role('writer').getPermissionNames()).toEqual(['edit articles'])
  })

  it('is idempotent', async () => {
    await rbac.sync(seed)
    const events: RbacEvent[] = []
    for (const name of ['permission.created', 'role.created', 'permission.attached', 'permission.detached'] as const) {
      rbac.on(name, (e) => {
        events.push(e)
      })
    }

    const again = await rbac.sync(seed)
    expect(again.created).toEqual({ permissions: [], roles: [] })
    expect(again.updated.roles).toEqual([])
    expect(again.deleted).toEqual({ permissions: [], roles: [] })
    expect(events).toEqual([])
    expect(await rbac.getPermissions()).toHaveLength(3)
    expect(await rbac.getRoles()).toHaveLength(2)
  })

  it('creates permissions referenced only by roles', async () => {
    await rbac.sync({ roles: { writer: ['edit articles', 'comment'] } })
    expect(sorted((await rbac.getPermissions()).map((p) => p.name))).toEqual(['comment', 'edit articles'])
  })

  it('syncs the permissions of existing roles and reports the diff', async () => {
    await rbac.sync(seed)
    const result = await rbac.sync({
      permissions: ['edit articles', 'delete articles', 'publish articles'],
      roles: { admin: '*', writer: ['edit articles', 'publish articles'] },
    })
    expect(result.updated.roles).toEqual([
      { name: 'writer', guard: 'web', team: null, attached: ['publish articles'], detached: [] },
    ])

    const shrink = await rbac.sync({ roles: { writer: [] } })
    expect(shrink.updated.roles).toEqual([
      { name: 'writer', guard: 'web', team: null, attached: [], detached: ['edit articles', 'publish articles'] },
    ])
    expect(await rbac.role('writer').getPermissionNames()).toEqual([])
  })

  it("expands '*' to every permission of the guard, including ones not in the definition", async () => {
    await rbac.createPermission('legacy')
    await rbac.sync(seed)
    expect(await rbac.role('admin').hasPermissionTo('legacy')).toBe(true)
  })

  it('fires the regular engine events', async () => {
    const events: string[] = []
    for (const name of ['permission.created', 'role.created', 'permission.attached', 'role.deleted', 'permission.deleted'] as const) {
      rbac.on(name, (e) => {
        events.push(e.event)
      })
    }
    await rbac.sync({ roles: { writer: ['edit articles'] } })
    expect(events).toEqual(['permission.created', 'role.created', 'permission.attached'])
  })

  it('does not touch roles & permissions outside the definition without prune', async () => {
    await rbac.createPermission('legacy')
    await rbac.createRole('old')
    const result = await rbac.sync({ roles: { writer: ['edit articles'] } })
    expect(result.deleted).toEqual({ permissions: [], roles: [] })
    expect(await rbac.findRole('old')).not.toBeNull()
    expect(await rbac.findPermission('legacy')).not.toBeNull()
  })

  describe('prune', () => {
    it('deletes roles & permissions of the guard that are not in the definition', async () => {
      await rbac.createPermission('legacy')
      await rbac.createRole('old')
      await rbac.role('old').givePermissionTo('legacy')
      await rbac.sync(seed)

      const result = await rbac.sync(seed, { prune: true })
      expect(result.deleted.roles).toEqual([{ name: 'old', guard: 'web', team: null, permissions: ['legacy'] }])
      expect(result.deleted.permissions).toEqual([{ name: 'legacy', guard: 'web' }])
      // admin had `legacy` through '*', it loses it
      expect(result.updated.roles).toEqual([
        { name: 'admin', guard: 'web', team: null, attached: [], detached: ['legacy'] },
      ])

      expect(await rbac.findRole('old')).toBeNull()
      expect(await rbac.findPermission('legacy')).toBeNull()
      expect(await rbac.getPermissions()).toHaveLength(3)
    })

    it('only prunes the guards / teams in the definition', async () => {
      await rbac.createPermission('api thing', { guard: 'api' })
      await rbac.createRole('api role', { guard: 'api' })
      await rbac.createRole('team role', { team: 1 })

      const result = await rbac.sync(seed, { prune: true })
      expect(result.deleted).toEqual({ permissions: [], roles: [] })
      expect(await rbac.findPermission('api thing', { guard: 'api' })).not.toBeNull()
      expect(await rbac.findRole('api role', { guard: 'api' })).not.toBeNull()
      expect(await rbac.findRole('team role', { team: 1 })).not.toBeNull()
    })
  })

  describe('dryRun', () => {
    it('returns the plan without writing', async () => {
      await rbac.createRole('old')
      const events: string[] = []
      rbac.on('permission.created', (e) => {
        events.push(e.event)
      })

      const plan = await rbac.sync(seed, { dryRun: true, prune: true })
      expect(plan.dryRun).toBe(true)
      expect(plan.created.permissions).toHaveLength(3)
      expect(plan.created.roles.map((r) => r.name)).toEqual(['admin', 'writer'])
      expect(plan.deleted.roles.map((r) => r.name)).toEqual(['old'])

      expect(await rbac.getPermissions()).toEqual([])
      expect((await rbac.getRoles()).map((r) => r.name)).toEqual(['old'])
      expect(events).toEqual([])

      // the plan matches what a real run does
      const { dryRun: _dry, ...applied } = await rbac.sync(seed, { prune: true })
      const { dryRun: _dry2, ...planned } = plan
      expect(applied).toEqual(planned)
    })
  })

  describe('guards & teams', () => {
    it('uses the guard option and per-definition guards', async () => {
      const result = await rbac.sync(
        [
          { permissions: ['edit articles'], roles: { writer: ['edit articles'] } },
          { guard: 'web', roles: { reader: [] } },
          { guard: 'admin', permissions: ['manage users'], roles: { admin: '*' } },
        ],
        { guard: 'api' },
      )
      expect(result.created.permissions).toEqual([
        { name: 'edit articles', guard: 'api' },
        { name: 'manage users', guard: 'admin' },
      ])
      expect(result.created.roles.map((r) => `${r.guard}:${r.name}`)).toEqual(['api:writer', 'web:reader', 'admin:admin'])
      expect(await rbac.role('writer', { guard: 'api' }).getPermissionNames()).toEqual(['edit articles'])
      expect(await rbac.role('admin', { guard: 'admin' }).getPermissionNames()).toEqual(['manage users'])
      expect(await rbac.findRole('writer')).toBeNull()
    })

    it('creates team roles and keeps them separate from global roles', async () => {
      await rbac.sync([
        { permissions: ['edit articles', 'manage team'], roles: { member: ['edit articles'] } },
        { team: 1, roles: { owner: '*', member: ['edit articles', 'manage team'] } },
      ])
      const teamMember = await rbac.findRoleOrFail('member', { team: 1 })
      const globalMember = await rbac.findRoleOrFail('member')
      expect(teamMember.teamId).toBe(1)
      expect(globalMember.teamId).toBeNull()
      expect(sorted(await rbac.role(teamMember).getPermissionNames())).toEqual(['edit articles', 'manage team'])
      expect(await rbac.role(globalMember).getPermissionNames()).toEqual(['edit articles'])

      // prune of team 1 leaves global roles alone
      const result = await rbac.sync({ team: 1, roles: { owner: '*' } }, { prune: true })
      expect(result.deleted.roles).toEqual([
        { name: 'member', guard: 'web', team: 1, permissions: ['edit articles', 'manage team'] },
      ])
      expect(result.deleted.permissions.map((p) => p.name)).toEqual([])
      expect(await rbac.findRole('member')).not.toBeNull()
    })

    it('uses the team option as default', async () => {
      await rbac.sync({ roles: { owner: [] } }, { team: 'acme' })
      expect((await rbac.findRoleOrFail('owner', { team: 'acme' })).teamId).toBe('acme')
    })

    it('throws when a team is given but teams are disabled', async () => {
      const plain = createRbac({ adapter: new MemoryAdapter() })
      await expect(plain.sync({ team: 1, roles: { owner: [] } })).rejects.toMatchObject({ code: 'TEAMS_NOT_ENABLED' })
    })
  })

  describe('validation', () => {
    it('rejects malformed definitions (e.g. from JSON)', async () => {
      const bad = [
        { permissions: 'edit' },
        { permissions: [1] },
        { roles: ['writer'] },
        { roles: { writer: 'edit' } },
        { guard: 5 },
      ]
      for (const definition of bad) {
        await expect(rbac.sync(definition as unknown as SyncDefinition)).rejects.toMatchObject({
          code: 'INVALID_SYNC_DEFINITION',
        })
      }
      await expect(rbac.sync({ permissions: ['  '] })).rejects.toBeInstanceOf(RbacError)
      expect(await rbac.getPermissions()).toEqual([])
    })

    it('rejects a role defined twice in the same scope', async () => {
      await expect(rbac.sync([{ roles: { writer: [] } }, { roles: { writer: [] } }])).rejects.toMatchObject({
        code: 'INVALID_SYNC_DEFINITION',
      })
    })

    it('validates wildcard permissions before writing', async () => {
      const wild = createRbac({ adapter: new MemoryAdapter(), wildcard: true })
      await expect(wild.sync({ permissions: ['articles.edit', 'bad..name'] })).rejects.toMatchObject({
        code: 'INVALID_WILDCARD_PERMISSION',
      })
      expect(await wild.getPermissions()).toEqual([])

      await wild.sync({ permissions: ['articles.*'], roles: { editor: ['articles.*'] } })
      await wild.for({ type: 'user', id: 1 }).assignRole('editor')
      expect(await wild.for({ type: 'user', id: 1 }).can('articles.edit')).toBe(true)
    })

    it('trims names', async () => {
      await rbac.sync({ permissions: [' edit '], roles: { ' writer ': [' edit'] } })
      expect(await rbac.role('writer').getPermissionNames()).toEqual(['edit'])
      expect((await rbac.sync({ roles: { writer: ['edit'] } })).updated.roles).toEqual([])
    })
  })
})

describe('rbac.sync typed names', () => {
  type AppTypes = { permissions: 'edit articles' | 'delete articles'; roles: 'writer' | 'admin' }

  it('accepts typed names and rejects unknown ones at compile time', async () => {
    const rbac = createRbac<AppTypes>({ adapter: new MemoryAdapter() })
    await rbac.sync({ permissions: ['edit articles'], roles: { admin: '*', writer: ['edit articles'] } })
    expect(await rbac.role('writer').getPermissionNames()).toEqual(['edit articles'])

    // Never executed — only type-checked.
    const typeOnly = async (): Promise<void> => {
      // @ts-expect-error unknown permission
      await rbac.sync({ permissions: ['fly'] })
      // @ts-expect-error unknown role
      await rbac.sync({ roles: { pilot: [] } })
      // @ts-expect-error unknown permission in a role
      await rbac.sync({ roles: { writer: ['fly'] } })
    }
    void typeOnly
  })
})
