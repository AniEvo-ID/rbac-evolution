/**
 * @anievo-id/rbac-evolution/testing
 *
 * Shared conformance test-suite for `RbacAdapter` implementations (requires vitest).
 *
 * ```ts
 * import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
 * runAdapterTests('PrismaAdapter', async () => {
 *   await resetDatabase()
 *   return new PrismaAdapter(prisma)
 * })
 * ```
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { RbacAdapter } from './adapter'
import { createRbac } from './rbac'
import type { Id } from './types'

export interface AdapterTestOptions {
  /** Whether the adapter's team columns are exercised (default: true). */
  teams?: boolean
}

const s = (ids: readonly Id[]): string[] => ids.map(String).sort()

/**
 * Registers a full `describe` block that checks an adapter honours the `RbacAdapter` contract.
 * `factory` is called before every test and must return an adapter backed by EMPTY storage.
 */
export function runAdapterTests(
  name: string,
  factory: () => RbacAdapter | Promise<RbacAdapter>,
  options: AdapterTestOptions = {},
): void {
  const teams = options.teams ?? true

  describe(`RbacAdapter conformance: ${name}`, () => {
    let adapter: RbacAdapter
    const alice = { type: 'user', id: 1 }
    const bob = { type: 'user', id: 2 }
    const robot = { type: 'client', id: 1 }

    beforeEach(async () => {
      adapter = await factory()
    })

    describe('permissions', () => {
      it('creates and finds by name, id and guard', async () => {
        const edit = await adapter.createPermission({ name: 'edit', guardName: 'web' })
        await adapter.createPermission({ name: 'edit', guardName: 'api' })
        await adapter.createPermission({ name: 'delete', guardName: 'web' })

        expect(edit).toMatchObject({ name: 'edit', guardName: 'web' })
        expect(await adapter.findPermissions()).toHaveLength(3)
        expect(await adapter.findPermissions({ guardName: 'web' })).toHaveLength(2)
        expect(await adapter.findPermissions({ names: ['edit'] })).toHaveLength(2)
        expect(await adapter.findPermissions({ names: ['edit'], guardName: 'api' })).toHaveLength(1)
        expect(await adapter.findPermissions({ names: [] })).toHaveLength(0)

        const byId = await adapter.findPermissions({ ids: [edit.id] })
        expect(byId).toHaveLength(1)
        expect(String(byId[0]!.id)).toBe(String(edit.id))
      })

      it('deletes a permission and its links', async () => {
        const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
        const r = await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
        await adapter.attachRolePermissions(r.id, [p.id])
        await adapter.attachSubjectPermissions(alice, [p.id], null)

        await adapter.deletePermission(p.id)

        expect(await adapter.findPermissions()).toHaveLength(0)
        expect(await adapter.getRolePermissionLinks([r.id])).toHaveLength(0)
        expect(await adapter.getSubjectPermissionIds(alice, null)).toHaveLength(0)
      })
    })

    describe('roles', () => {
      it('creates and finds by name, id, guard and team', async () => {
        const writer = await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
        await adapter.createRole({ name: 'writer', guardName: 'api', teamId: null })

        expect(writer).toMatchObject({ name: 'writer', guardName: 'web', teamId: null })
        expect(await adapter.findRoles()).toHaveLength(2)
        expect(await adapter.findRoles({ guardName: 'web' })).toHaveLength(1)
        expect(await adapter.findRoles({ names: ['writer'] })).toHaveLength(2)
        expect(s((await adapter.findRoles({ ids: [writer.id] })).map((r) => r.id))).toEqual(s([writer.id]))
        expect(await adapter.findRoles({ teamIds: [null] })).toHaveLength(2)
      })

      it('only matches ids written exactly as stored', async () => {
        const role = await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
        // '7.0' or '7e0' must not resolve to role 7 (Number('7.0') === 7).
        for (const id of [`${role.id}.0`, `${role.id}e0`, ` ${role.id}x`]) {
          expect(await adapter.findRoles({ ids: [id] })).toEqual([])
        }
      })

      if (teams) {
        it('filters by team ids including null (global)', async () => {
          await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
          const t1 = await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 1 })
          await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 2 })

          expect(t1.teamId === null ? null : String(t1.teamId)).toBe('1')
          expect(await adapter.findRoles({ teamIds: [null] })).toHaveLength(1)
          expect(await adapter.findRoles({ teamIds: [1] })).toHaveLength(1)
          expect(await adapter.findRoles({ teamIds: [1, null] })).toHaveLength(2)
          expect(await adapter.findRoles({ teamIds: [] })).toHaveLength(0)
        })
      }

      it('deletes a role and its links', async () => {
        const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
        const r = await adapter.createRole({ name: 'writer', guardName: 'web', teamId: null })
        await adapter.attachRolePermissions(r.id, [p.id])
        await adapter.attachSubjectRoles(alice, [r.id], null)

        await adapter.deleteRole(r.id)

        expect(await adapter.findRoles()).toHaveLength(0)
        expect(await adapter.getRolePermissionLinks([r.id])).toHaveLength(0)
        expect(await adapter.getSubjectRoleIds(alice, null)).toHaveLength(0)
        expect(await adapter.findPermissions()).toHaveLength(1)
      })
    })

    describe('role ↔ permission links', () => {
      it('attaches idempotently and detaches some or all', async () => {
        const a = await adapter.createPermission({ name: 'a', guardName: 'web' })
        const b = await adapter.createPermission({ name: 'b', guardName: 'web' })
        const r1 = await adapter.createRole({ name: 'r1', guardName: 'web', teamId: null })
        const r2 = await adapter.createRole({ name: 'r2', guardName: 'web', teamId: null })

        await adapter.attachRolePermissions(r1.id, [a.id, b.id])
        await adapter.attachRolePermissions(r1.id, [a.id])
        await adapter.attachRolePermissions(r2.id, [a.id])

        expect(await adapter.getRolePermissionLinks([r1.id])).toHaveLength(2)
        expect(await adapter.getRolePermissionLinks([r1.id, r2.id])).toHaveLength(3)
        expect(await adapter.getRolePermissionLinks([])).toHaveLength(0)

        await adapter.detachRolePermissions(r1.id, [a.id])
        expect(s((await adapter.getRolePermissionLinks([r1.id])).map((l) => l.permissionId))).toEqual(s([b.id]))

        await adapter.detachRolePermissions(r1.id)
        expect(await adapter.getRolePermissionLinks([r1.id])).toHaveLength(0)
        expect(await adapter.getRolePermissionLinks([r2.id])).toHaveLength(1)
      })
    })

    describe('subject links', () => {
      it('roles: attach idempotently, isolate subjects and subject types, detach some or all', async () => {
        const r1 = await adapter.createRole({ name: 'r1', guardName: 'web', teamId: null })
        const r2 = await adapter.createRole({ name: 'r2', guardName: 'web', teamId: null })

        await adapter.attachSubjectRoles(alice, [r1.id, r2.id], null)
        await adapter.attachSubjectRoles(alice, [r1.id], null)
        await adapter.attachSubjectRoles(bob, [r1.id], null)

        expect(s(await adapter.getSubjectRoleIds(alice, null))).toEqual(s([r1.id, r2.id]))
        expect(s(await adapter.getSubjectRoleIds(bob, null))).toEqual(s([r1.id]))
        expect(await adapter.getSubjectRoleIds(robot, null)).toHaveLength(0)

        await adapter.detachSubjectRoles(alice, [r1.id], null)
        expect(s(await adapter.getSubjectRoleIds(alice, null))).toEqual(s([r2.id]))

        await adapter.detachSubjectRoles(alice, undefined, null)
        expect(await adapter.getSubjectRoleIds(alice, null)).toHaveLength(0)
        expect(await adapter.getSubjectRoleIds(bob, null)).toHaveLength(1)
      })

      it('permissions: attach idempotently, detach some or all', async () => {
        const a = await adapter.createPermission({ name: 'a', guardName: 'web' })
        const b = await adapter.createPermission({ name: 'b', guardName: 'web' })

        await adapter.attachSubjectPermissions(alice, [a.id, b.id], null)
        await adapter.attachSubjectPermissions(alice, [a.id], null)
        expect(s(await adapter.getSubjectPermissionIds(alice, null))).toEqual(s([a.id, b.id]))

        await adapter.detachSubjectPermissions(alice, [b.id], null)
        expect(s(await adapter.getSubjectPermissionIds(alice, null))).toEqual(s([a.id]))

        await adapter.detachSubjectPermissions(alice, undefined, null)
        expect(await adapter.getSubjectPermissionIds(alice, null)).toHaveLength(0)
      })

      it('supports string subject ids (UUID)', async () => {
        const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
        const uuidUser = { type: 'user', id: '0b6f8f3e-6d1a-4c55-9a43-6f1f2e9d1a10' }
        await adapter.attachSubjectRoles(uuidUser, [r.id], null)
        expect(s(await adapter.getSubjectRoleIds(uuidUser, null))).toEqual(s([r.id]))
      })

      if (teams) {
        it('scopes subject links per team', async () => {
          const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
          const p = await adapter.createPermission({ name: 'p', guardName: 'web' })

          await adapter.attachSubjectRoles(alice, [r.id], 1)
          await adapter.attachSubjectPermissions(alice, [p.id], 1)

          expect(await adapter.getSubjectRoleIds(alice, 1)).toHaveLength(1)
          expect(await adapter.getSubjectRoleIds(alice, 2)).toHaveLength(0)
          expect(await adapter.getSubjectRoleIds(alice, null)).toHaveLength(0)
          expect(await adapter.getSubjectPermissionIds(alice, 1)).toHaveLength(1)
          expect(await adapter.getSubjectPermissionIds(alice, null)).toHaveLength(0)

          await adapter.detachSubjectRoles(alice, undefined, 2)
          expect(await adapter.getSubjectRoleIds(alice, 1)).toHaveLength(1)
        })
      }
    })

    describe('reverse lookups', () => {
      it('finds subjects by role and by direct permission', async () => {
        const r1 = await adapter.createRole({ name: 'r1', guardName: 'web', teamId: null })
        const r2 = await adapter.createRole({ name: 'r2', guardName: 'web', teamId: null })
        const p = await adapter.createPermission({ name: 'p', guardName: 'web' })

        await adapter.attachSubjectRoles(alice, [r1.id, r2.id], null)
        await adapter.attachSubjectRoles(bob, [r2.id], null)
        await adapter.attachSubjectRoles(robot, [r1.id], null)
        await adapter.attachSubjectPermissions(bob, [p.id], null)

        expect(s(await adapter.getSubjectIdsWithRoles('user', [r1.id], null))).toEqual(['1'])
        expect(s(await adapter.getSubjectIdsWithRoles('user', [r1.id, r2.id], null))).toEqual(['1', '2'])
        expect(s(await adapter.getSubjectIdsWithRoles('client', [r1.id], null))).toEqual(['1'])
        expect(await adapter.getSubjectIdsWithRoles('user', [], null)).toHaveLength(0)
        expect(s(await adapter.getSubjectIdsWithPermissions('user', [p.id], null))).toEqual(['2'])
      })
    })

    describe('engine integration', () => {
      it('runs a full flow through createRbac', async () => {
        const rbac = createRbac({ adapter, teams, cache: false })
        await rbac.createPermission('edit articles')
        await rbac.createRole('writer')
        await rbac.role('writer').givePermissionTo('edit articles')

        const user = rbac.for(alice)
        await user.assignRole('writer')

        expect(await user.hasRole('writer')).toBe(true)
        expect(await user.can('edit articles')).toBe(true)
        expect(await rbac.for(bob).can('edit articles')).toBe(false)
      })
    })
  })
}
