import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaAdapter } from '../src'
import { PrismaClient } from './generated'

// `test/generated` + `test/.tmp/test.db` are created by `node test/prepare.mjs` (run by `pnpm test`).
const prisma = new PrismaClient()

afterAll(async () => {
  await prisma.$disconnect()
})

async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.rbacModelHasPermission.deleteMany(),
    prisma.rbacModelHasRole.deleteMany(),
    prisma.rbacRoleHasPermission.deleteMany(),
    prisma.rbacRole.deleteMany(),
    prisma.rbacPermission.deleteMany(),
  ])
}

runAdapterTests('PrismaAdapter', async () => {
  await resetDatabase()
  return new PrismaAdapter(prisma)
})

describe('PrismaAdapter specifics', () => {
  let adapter: PrismaAdapter
  const alice = { type: 'user', id: 1 }

  beforeEach(async () => {
    await resetDatabase()
    adapter = new PrismaAdapter(prisma)
  })

  describe('ids', () => {
    it('returns numeric role / permission ids', async () => {
      const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
      const r = await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
      expect(typeof p.id).toBe('number')
      expect(typeof r.id).toBe('number')
    })

    it('accepts numeric strings wherever an id is expected', async () => {
      const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
      const r = await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
      const pid = String(p.id)
      const rid = String(r.id)

      expect(await adapter.findPermissions({ ids: [pid] })).toEqual([p])
      expect(await adapter.findRoles({ ids: [rid] })).toEqual([r])

      await adapter.attachRolePermissions(rid, [pid])
      await adapter.attachRolePermissions(r.id, [p.id]) // same link, mixed types → still one row
      expect(await adapter.getRolePermissionLinks([rid])).toEqual([{ roleId: r.id, permissionId: p.id }])

      await adapter.attachSubjectRoles(alice, [rid], null)
      await adapter.attachSubjectRoles(alice, [r.id], null)
      expect(await adapter.getSubjectRoleIds(alice, null)).toEqual([r.id])

      await adapter.detachSubjectRoles(alice, [rid], null)
      expect(await adapter.getSubjectRoleIds(alice, null)).toEqual([])

      await adapter.deleteRole(rid)
      await adapter.deletePermission(pid)
      expect(await adapter.findRoles()).toEqual([])
      expect(await adapter.findPermissions()).toEqual([])
    })

    it('ignores non-integer ids in lookups and deletes, rejects them on attach', async () => {
      const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
      const r = await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })

      expect(await adapter.findPermissions({ ids: ['not-a-number', 1.5] })).toEqual([])
      expect(await adapter.findRoles({ ids: ['abc'] })).toEqual([])
      expect(await adapter.getRolePermissionLinks(['abc'])).toEqual([])
      await adapter.deleteRole('abc')
      await adapter.deletePermission('abc')
      expect(await adapter.findRoles()).toHaveLength(1)

      await expect(adapter.attachRolePermissions(r.id, ['abc'])).rejects.toBeInstanceOf(TypeError)
      await expect(adapter.attachRolePermissions('abc', [p.id])).rejects.toBeInstanceOf(TypeError)
      await expect(adapter.attachSubjectRoles(alice, ['x'], null)).rejects.toBeInstanceOf(TypeError)
      await expect(adapter.attachSubjectPermissions(alice, ['x'], null)).rejects.toBeInstanceOf(TypeError)
    })

    it('stores subject ids as text: 1 and "1" are the same subject, reverse lookups return strings', async () => {
      const r = await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
      await adapter.attachSubjectRoles({ type: 'user', id: 1 }, [r.id], null)
      await adapter.attachSubjectRoles({ type: 'user', id: '1' }, [r.id], null)

      expect(await adapter.getSubjectRoleIds({ type: 'user', id: '1' }, null)).toEqual([r.id])
      expect(await adapter.getSubjectIdsWithRoles('user', [r.id], null)).toEqual(['1'])
      expect(await prisma.rbacModelHasRole.count()).toBe(1)
    })
  })

  describe('teams', () => {
    it("stores the global team as '' and returns it as null; other teams as strings", async () => {
      const global = await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
      const team = await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 7 })

      expect(global.teamId).toBeNull()
      expect(team.teamId).toBe('7')

      const rows = await prisma.rbacRole.findMany({ orderBy: { id: 'asc' } })
      expect(rows.map((row) => row.teamId)).toEqual(['', '7'])

      expect(await adapter.findRoles({ teamIds: ['7'] })).toEqual([team])
      expect(await adapter.findRoles({ teamIds: [7, null] })).toEqual([global, team])
    })

    it('scopes subject links by team (numeric and string team ids are equivalent)', async () => {
      const r = await adapter.createRole({ name: 'member', guardName: 'web', teamId: null })
      await adapter.attachSubjectRoles(alice, [r.id], 5)
      await adapter.attachSubjectRoles(alice, [r.id], '5')

      expect(await adapter.getSubjectRoleIds(alice, '5')).toEqual([r.id])
      expect(await adapter.getSubjectRoleIds(alice, null)).toEqual([])
      expect(await adapter.getSubjectIdsWithRoles('user', [r.id], 5)).toEqual(['1'])
      expect(await adapter.getSubjectIdsWithRoles('user', [r.id], null)).toEqual([])
    })

    it('enforces unique (name, guard_name, team_id) including the global team', async () => {
      await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
      await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 1 })
      await expect(adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })).rejects.toMatchObject({
        code: 'P2002',
      })
      await adapter.createPermission({ name: 'edit', guardName: 'web' })
      await expect(adapter.createPermission({ name: 'edit', guardName: 'web' })).rejects.toMatchObject({
        code: 'P2002',
      })
    })

    it('works end-to-end with createRbac({ teams: true })', async () => {
      const rbac = createRbac({ adapter, teams: true, cache: false })
      await rbac.createPermission('manage billing')
      await rbac.createRole('admin')
      await rbac.role('admin').givePermissionTo('manage billing')
      const manager = await rbac.createRole('manager', { team: 1 })
      expect(manager.teamId).toBe('1')

      await rbac.for(alice, { team: 1 }).assignRole('admin', 'manager')

      expect(await rbac.for(alice, { team: 1 }).can('manage billing')).toBe(true)
      expect(await rbac.for(alice, { team: 1 }).hasRole('manager')).toBe(true)
      expect(await rbac.for(alice, { team: 2 }).can('manage billing')).toBe(false)
      expect((await rbac.findRoleOrFail('manager', { team: 1 })).id).toBe(manager.id)
    })
  })

  describe('attach', () => {
    it('is idempotent under concurrent attaches of the same links', async () => {
      const a = await adapter.createPermission({ name: 'a', guardName: 'web' })
      const b = await adapter.createPermission({ name: 'b', guardName: 'web' })
      const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })

      await Promise.all([
        adapter.attachRolePermissions(r.id, [a.id, b.id]),
        adapter.attachRolePermissions(r.id, [a.id]),
        adapter.attachSubjectPermissions(alice, [a.id, b.id], null),
        adapter.attachSubjectPermissions(alice, [b.id], null),
      ])

      expect(await adapter.getRolePermissionLinks([r.id])).toHaveLength(2)
      expect(await adapter.getSubjectPermissionIds(alice, null)).toHaveLength(2)
    })

    it('deduplicates ids within a single call', async () => {
      const a = await adapter.createPermission({ name: 'a', guardName: 'web' })
      const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
      await adapter.attachRolePermissions(r.id, [a.id, a.id, String(a.id)])
      expect(await adapter.getRolePermissionLinks([r.id])).toHaveLength(1)
    })
  })
})
