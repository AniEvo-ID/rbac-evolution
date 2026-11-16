/**
 * `revokeAll()`, `teams()` and `deleteTeam()`: scopes, events, cache, and the engine's behaviour with an
 * adapter that lacks the optional bulk methods (fallback or a clear `ADAPTER_METHOD_MISSING` error).
 */
import { describe, expect, it, vi } from 'vitest'
import { createRbac, MemoryAdapter, type RbacAdapter, type RbacEvent } from '../src'

const alice = { type: 'user', id: 1 }
const bob = { type: 'user', id: 2 }

type Optional = 'getSubjectLinks' | 'getTeamLinks' | 'detachTeamLinks'
const OPTIONAL: readonly Optional[] = ['getSubjectLinks', 'getTeamLinks', 'detachTeamLinks']

/** A MemoryAdapter that hides the optional methods (all of them, or all but `keep`): a 1.0 custom adapter. */
function withoutOptional(keep: readonly Optional[] = []): { adapter: RbacAdapter; inner: MemoryAdapter } {
  const inner = new MemoryAdapter()
  const adapter = new Proxy(inner, {
    get(target, key, receiver) {
      if ((OPTIONAL as readonly PropertyKey[]).includes(key) && !(keep as readonly PropertyKey[]).includes(key)) {
        return undefined
      }
      const value: unknown = Reflect.get(target, key, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as RbacAdapter
  return { adapter, inner }
}

/** Records every event as a short line, e.g. `role.detached user:1 web@acme member,owner`. */
function record(rbac: ReturnType<typeof createRbac>): string[] {
  const log: string[] = []
  const push = (e: RbacEvent) => {
    switch (e.event) {
      case 'role.attached':
      case 'role.detached':
        log.push(`${e.event} ${e.subject.type}:${String(e.subject.id)} ${e.guardName}@${String(e.teamId)} ${e.roles.map((r) => r.name).sort().join(',')}`)
        break
      case 'permission.attached':
      case 'permission.detached':
        log.push(
          `${e.event} ${e.target === 'subject' ? `${e.subject.type}:${String(e.subject.id)}` : `role:${e.role.name}`} ${e.guardName}@${String(e.teamId)} ${e.permissions.map((p) => p.name).sort().join(',')}`,
        )
        break
      case 'role.deleted':
        log.push(`${e.event} ${e.role.name}@${String(e.teamId)}`)
        break
      default:
        log.push(e.event)
    }
  }
  for (const name of ['role.detached', 'permission.detached', 'role.deleted', 'role.attached'] as const) rbac.on(name, push)
  return log
}

/** Two guards, two teams, the global scope, and a second user. */
async function seed(rbac: ReturnType<typeof createRbac>) {
  await rbac.createPermission('edit')
  await rbac.createPermission('call', { guard: 'api' })
  await rbac.createRole('member')
  await rbac.createRole('bot', { guard: 'api' })
  await rbac.createRole('owner', { team: 'acme' })
  await rbac.for(alice).assignRole('member')
  await rbac.for(alice).givePermissionTo('edit')
  await rbac.for(alice, { team: 'acme' }).assignRole('owner', 'member')
  await rbac.for(alice, { team: 'acme' }).givePermissionTo('edit')
  await rbac.for(alice, { team: 'acme', guard: 'api' }).assignRole('bot')
  await rbac.for(alice, { team: 'acme', guard: 'api' }).givePermissionTo('call')
  await rbac.for(alice, { team: 'beta' }).assignRole('member')
  await rbac.for(bob, { team: 'acme' }).assignRole('member')
}

describe('revokeAll()', () => {
  it('only touches the current guard and team by default', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await seed(rbac)
    const log = record(rbac)

    await rbac.for(alice, { team: 'acme' }).revokeAll()

    expect(await rbac.for(alice, { team: 'acme' }).getRoleNames()).toEqual([])
    expect(await rbac.for(alice, { team: 'acme' }).getDirectPermissions()).toEqual([])
    expect(await rbac.for(alice, { team: 'acme', guard: 'api' }).getRoleNames()).toEqual(['bot'])
    expect(await rbac.for(alice).getRoleNames()).toEqual(['member'])
    expect(await rbac.for(alice, { team: 'beta' }).getRoleNames()).toEqual(['member'])
    expect(await rbac.for(bob, { team: 'acme' }).getRoleNames()).toEqual(['member'])
    expect(log).toEqual(['role.detached user:1 web@acme member,owner', 'permission.detached user:1 web@acme edit'])
  })

  it('allGuards: every guard of the current team, one event per guard', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await seed(rbac)
    const log = record(rbac)

    await rbac.for(alice, { team: 'acme' }).revokeAll({ allGuards: true })

    expect(await rbac.for(alice, { team: 'acme', guard: 'api' }).getRoleNames()).toEqual([])
    expect(await rbac.for(alice, { team: 'acme', guard: 'api' }).getDirectPermissions()).toEqual([])
    expect(await rbac.for(alice).getRoleNames()).toEqual(['member'])
    expect(log).toEqual([
      'role.detached user:1 web@acme member,owner',
      'role.detached user:1 api@acme bot',
      'permission.detached user:1 web@acme edit',
      'permission.detached user:1 api@acme call',
    ])
  })

  it('allTeams: every team and the global scope, in the current guard', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await seed(rbac)
    const log = record(rbac)

    await rbac.for(alice).revokeAll({ allTeams: true })

    for (const team of [null, 'acme', 'beta']) {
      expect(await rbac.for(alice, { team }).getRoleNames(), String(team)).toEqual([])
    }
    expect(await rbac.for(alice, { team: 'acme', guard: 'api' }).getRoleNames()).toEqual(['bot'])
    expect(await rbac.for(bob, { team: 'acme' }).getRoleNames()).toEqual(['member'])
    expect(log).toEqual([
      'role.detached user:1 web@null member',
      'permission.detached user:1 web@null edit',
      'role.detached user:1 web@acme member,owner',
      'permission.detached user:1 web@acme edit',
      'role.detached user:1 web@beta member',
    ])
  })

  it('allGuards + allTeams: removes the subject from everything (spatie: deleting the model)', async () => {
    const { adapter, inner } = withoutOptional(['getSubjectLinks'])
    const rbac = createRbac({ adapter, teams: true })
    await seed(rbac)
    // A link to a role that no longer exists is removed too.
    await inner.attachSubjectRoles(alice, [999], 'gamma')

    await rbac.for(alice).revokeAll({ allGuards: true, allTeams: true })

    expect(await inner.getSubjectLinks(alice)).toEqual({ roles: [], permissions: [] })
    expect(await rbac.for(bob, { team: 'acme' }).getRoleNames()).toEqual(['member'])
  })

  it('emits nothing when there is nothing to remove', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await seed(rbac)
    const log = record(rbac)
    await rbac.for({ type: 'user', id: 99 }).revokeAll({ allGuards: true, allTeams: true })
    await rbac.for({ type: 'user', id: 99 }).revokeAll()
    expect(log).toEqual([])
  })

  it('skips the role and permission lookups with allGuards and no listener', async () => {
    const adapter = new MemoryAdapter()
    const rbac = createRbac({ adapter, teams: true })
    await seed(rbac)
    const findRoles = vi.spyOn(adapter, 'findRoles')
    await rbac.for(alice, { team: 'acme' }).revokeAll({ allGuards: true })
    expect(findRoles).not.toHaveBeenCalled()
    expect(await adapter.getSubjectRoleIds(alice, 'acme')).toEqual([])
  })

  it('clears the cache', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await rbac.createPermission('edit')
    await rbac.createRole('writer')
    await rbac.role('writer').givePermissionTo('edit')
    await rbac.for(alice).assignRole('writer')
    expect(await rbac.for(alice).can('edit')).toBe(true) // cached

    await rbac.for(alice).revokeAll()
    expect(await rbac.for(alice).can('edit')).toBe(false)
  })

  describe('with an adapter without the optional methods', () => {
    it('works in the current team, in one guard or all (required methods only)', async () => {
      const { adapter } = withoutOptional()
      const rbac = createRbac({ adapter, teams: true })
      await seed(rbac)

      await rbac.for(alice, { team: 'acme' }).revokeAll()
      expect(await rbac.for(alice, { team: 'acme', guard: 'api' }).getRoleNames()).toEqual(['bot'])
      await rbac.for(alice, { team: 'acme' }).revokeAll({ allGuards: true })
      expect(await rbac.for(alice, { team: 'acme', guard: 'api' }).getRoleNames()).toEqual([])
      expect(await rbac.for(alice).getRoleNames()).toEqual(['member'])
    })

    it('allTeams throws ADAPTER_METHOD_MISSING before writing anything', async () => {
      const { adapter } = withoutOptional()
      const rbac = createRbac({ adapter, teams: true })
      await seed(rbac)

      await expect(rbac.for(alice).revokeAll({ allTeams: true })).rejects.toMatchObject({
        code: 'ADAPTER_METHOD_MISSING',
        message: expect.stringContaining('getSubjectLinks'),
      })
      expect(await rbac.for(alice).getRoleNames()).toEqual(['member'])
    })

    it('allTeams with teams disabled is the global scope, so needs no optional method', async () => {
      const { adapter } = withoutOptional()
      const rbac = createRbac({ adapter })
      await rbac.createRole('member')
      await rbac.for(alice).assignRole('member')

      await rbac.for(alice).revokeAll({ allTeams: true })
      expect(await rbac.for(alice).getRoleNames()).toEqual([])
    })
  })
})

describe('teams()', () => {
  it('lists the teams where the subject has a role or a direct permission in the guard', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await seed(rbac)
    await rbac.for(alice, { team: 'gamma', guard: 'api' }).givePermissionTo('call')
    await rbac.for(alice, { team: 'delta' }).givePermissionTo('edit')

    expect((await rbac.for(alice).teams()).sort()).toEqual(['acme', 'beta', 'delta'])
    expect((await rbac.for(alice, { guard: 'api' }).teams()).sort()).toEqual(['acme', 'gamma'])
    expect((await rbac.for(alice).teams({ allGuards: true })).sort()).toEqual(['acme', 'beta', 'delta', 'gamma'])
    expect(await rbac.for(bob).teams()).toEqual(['acme'])
    expect(await rbac.for({ type: 'user', id: 99 }).teams()).toEqual([])
  })

  it('ignores the scope team, and never lists the global scope', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await rbac.createRole('member')
    await rbac.for(alice).assignRole('member')
    await rbac.for(alice, { team: 7 }).assignRole('member')
    expect(await rbac.for(alice, { team: 3 }).teams()).toEqual([7])
  })

  it('is cached, and the cache is cleared by a change', async () => {
    const adapter = new MemoryAdapter()
    const rbac = createRbac({ adapter, teams: true })
    await rbac.createRole('member')
    await rbac.for(alice, { team: 'acme' }).assignRole('member')
    const links = vi.spyOn(adapter, 'getSubjectLinks')

    expect(await rbac.for(alice).teams()).toEqual(['acme'])
    expect(await rbac.for(alice).teams()).toEqual(['acme'])
    expect(links).toHaveBeenCalledTimes(1)

    await rbac.for(alice, { team: 'beta' }).assignRole('member')
    expect((await rbac.for(alice).teams()).sort()).toEqual(['acme', 'beta'])
  })

  it('throws TEAMS_NOT_ENABLED without teams', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await expect(rbac.for(alice).teams()).rejects.toMatchObject({ code: 'TEAMS_NOT_ENABLED' })
  })

  it('throws ADAPTER_METHOD_MISSING without getSubjectLinks (no fallback)', async () => {
    const { adapter } = withoutOptional()
    const rbac = createRbac({ adapter, teams: true })
    await expect(rbac.for(alice).teams()).rejects.toMatchObject({
      code: 'ADAPTER_METHOD_MISSING',
      message: expect.stringContaining('getSubjectLinks'),
    })
  })
})

describe('deleteTeam()', () => {
  it('removes every link in the team and the roles scoped to it, nothing else', async () => {
    const adapter = new MemoryAdapter()
    const rbac = createRbac({ adapter, teams: true })
    await seed(rbac)
    await rbac.role('owner', { team: 'acme' }).givePermissionTo('edit')

    await rbac.deleteTeam('acme')

    expect(await adapter.getTeamLinks('acme')).toEqual({ roles: [], permissions: [] })
    expect(await rbac.findRole('owner', { team: 'acme' })).toBeNull()
    expect(await adapter.findRoles({ teamIds: ['acme'] })).toEqual([])
    expect(await rbac.findRole('member')).not.toBeNull()
    expect(await rbac.findPermission('edit')).not.toBeNull()
    expect(await rbac.for(alice).getRoleNames()).toEqual(['member'])
    expect(await rbac.for(alice, { team: 'beta' }).getRoleNames()).toEqual(['member'])
  })

  it('emits role.detached / permission.detached per subject and guard, then role.deleted', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await seed(rbac)
    const log = record(rbac)

    await rbac.deleteTeam('acme')

    expect(log).toEqual([
      'role.detached user:1 web@acme member,owner',
      'role.detached user:1 api@acme bot',
      'permission.detached user:1 web@acme edit',
      'permission.detached user:1 api@acme call',
      'role.detached user:2 web@acme member',
      'role.deleted owner@acme',
    ])
  })

  it("clears every member's cached access", async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await seed(rbac)
    expect(await rbac.for(bob, { team: 'acme' }).hasRole('member')).toBe(true) // cached
    expect(await rbac.for(alice, { team: 'acme' }).can('edit')).toBe(true) // cached

    await rbac.deleteTeam('acme')

    expect(await rbac.for(bob, { team: 'acme' }).hasRole('member')).toBe(false)
    expect(await rbac.for(alice, { team: 'acme' }).can('edit')).toBe(false)
  })

  it('does nothing for a team without links or roles', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await seed(rbac)
    const log = record(rbac)
    await rbac.deleteTeam('nobody')
    expect(log).toEqual([])
    expect(await rbac.for(alice, { team: 'acme' }).getRoleNames()).toEqual(['member', 'owner'])
  })

  it('throws TEAMS_NOT_ENABLED without teams', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await expect(rbac.deleteTeam(1)).rejects.toMatchObject({ code: 'TEAMS_NOT_ENABLED' })
  })

  it('refuses the global scope (null or an empty string)', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await rbac.createRole('member')
    await rbac.for(alice).assignRole('member')
    for (const team of [null, undefined, '']) {
      await expect(rbac.deleteTeam(team as never)).rejects.toBeInstanceOf(TypeError)
    }
    expect(await rbac.for(alice).getRoleNames()).toEqual(['member'])
  })

  describe('with an adapter without the optional methods', () => {
    it('throws ADAPTER_METHOD_MISSING without getTeamLinks, before writing anything', async () => {
      const { adapter } = withoutOptional()
      const rbac = createRbac({ adapter, teams: true })
      await seed(rbac)

      await expect(rbac.deleteTeam('acme')).rejects.toMatchObject({
        code: 'ADAPTER_METHOD_MISSING',
        message: expect.stringContaining('getTeamLinks'),
      })
      expect(await rbac.for(alice, { team: 'acme' }).getRoleNames()).toEqual(['member', 'owner'])
    })

    it('falls back to one detach per subject without detachTeamLinks', async () => {
      const { adapter, inner } = withoutOptional(['getTeamLinks'])
      const rbac = createRbac({ adapter, teams: true })
      await seed(rbac)
      // Dangling links (to a role and a permission that don't exist).
      await inner.attachSubjectRoles({ type: 'client', id: 1 }, [998], 'acme')
      await inner.attachSubjectPermissions({ type: 'client', id: 1 }, [999], 'acme')
      const log = record(rbac)
      const detachRoles = vi.spyOn(inner, 'detachSubjectRoles')
      const detachPermissions = vi.spyOn(inner, 'detachSubjectPermissions')

      await rbac.deleteTeam('acme')

      expect(detachRoles.mock.calls).toEqual([
        [alice, undefined, 'acme'],
        [bob, undefined, 'acme'],
        [{ type: 'client', id: 1 }, undefined, 'acme'],
      ])
      expect(detachPermissions.mock.calls).toEqual([
        [alice, undefined, 'acme'],
        [{ type: 'client', id: 1 }, undefined, 'acme'],
      ])
      expect(await inner.getTeamLinks('acme')).toEqual({ roles: [], permissions: [] })
      expect(await rbac.findRole('owner', { team: 'acme' })).toBeNull()
      // The dangling links have no role or permission to report, so they emit nothing.
      expect(log).toContain('role.detached user:2 web@acme member')
      expect(log.filter((line) => line.includes('client:1'))).toEqual([])
    })
  })
})
