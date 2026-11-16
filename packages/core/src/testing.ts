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
import type { RbacAdapter, SubjectLinks } from './adapter'
import { createRbac } from './rbac'
import type { Id, TeamId } from './types'

export interface AdapterTestOptions {
  /** Whether the adapter's team columns are exercised (default: true). */
  teams?: boolean | undefined
}

const s = (ids: readonly Id[]): string[] => ids.map(String).sort()

const ACCENTS: Record<string, string> = { a: 'à', e: 'é', i: 'í', o: 'ó', u: 'ú' }
/** Other case, a trailing space, and an accent on the first vowel: `admin` → `ADMIN`, `admin `, `àdmin`. */
const lookalikes = (value: string): string[] => [
  value.toUpperCase(),
  `${value} `,
  value.replace(/[aeiou]/, (vowel) => ACCENTS[vowel]!),
]

const team = (teamId: TeamId): string | null => (teamId === null ? null : String(teamId))
/** One `type:id:target@team` string per link, sorted: compares links whatever id types the adapter returns. */
const rows = (links: SubjectLinks): { roles: string[]; permissions: string[] } => ({
  roles: links.roles.map((l) => `${l.subject.type}:${String(l.subject.id)}:${String(l.roleId)}@${team(l.teamId)}`).sort(),
  permissions: links.permissions
    .map((l) => `${l.subject.type}:${String(l.subject.id)}:${String(l.permissionId)}@${team(l.teamId)}`)
    .sort(),
})
const row = (subject: { type: string; id: Id }, target: { id: Id }, teamId: TeamId): string =>
  `${subject.type}:${String(subject.id)}:${String(target.id)}@${team(teamId)}`

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
    const carol = { type: 'user', id: 3 }
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

      if (teams) {
        it('only finds subjects linked in the given team', async () => {
          const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
          const p = await adapter.createPermission({ name: 'p', guardName: 'web' })
          await adapter.attachSubjectRoles(alice, [r.id], 1)
          await adapter.attachSubjectRoles(bob, [r.id], 2)
          await adapter.attachSubjectRoles(carol, [r.id], null)
          await adapter.attachSubjectPermissions(alice, [p.id], 1)
          await adapter.attachSubjectPermissions(bob, [p.id], null)

          expect(s(await adapter.getSubjectIdsWithRoles('user', [r.id], 1))).toEqual(['1'])
          expect(s(await adapter.getSubjectIdsWithRoles('user', [r.id], 2))).toEqual(['2'])
          expect(s(await adapter.getSubjectIdsWithRoles('user', [r.id], null))).toEqual(['3'])
          expect(s(await adapter.getSubjectIdsWithPermissions('user', [p.id], 1))).toEqual(['1'])
          expect(s(await adapter.getSubjectIdsWithPermissions('user', [p.id], null))).toEqual(['2'])
          expect(await adapter.getSubjectIdsWithPermissions('user', [p.id], 3)).toHaveLength(0)
        })
      }
    })

    // Databases compare text with their collation: MySQL's default (utf8mb4_0900_ai_ci) ignores case and
    // accents, SQL Server's usually ignores case, and older PAD SPACE collations ignore trailing spaces.
    // An adapter must still match exactly, or a subject `ADMIN` could get the roles of `admin`.
    describe('exact matching', () => {
      it('never returns a role or permission for a lookalike name or guard', async () => {
        const permission = await adapter.createPermission({ name: 'edit', guardName: 'web' })
        const role = await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
        // A unique index may reject a lookalike under some collations: that is fine (fail closed).
        // What must never happen is a lookup returning a row with another name.
        for (const name of lookalikes('edit')) {
          await Promise.resolve(adapter.createPermission({ name, guardName: 'web' })).catch(() => undefined)
        }
        for (const name of lookalikes('admin')) {
          await Promise.resolve(adapter.createRole({ name, guardName: 'web', teamId: null })).catch(() => undefined)
        }

        const permissions = await adapter.findPermissions({ names: ['edit'] })
        expect(permissions.map((p) => [String(p.id), p.name])).toEqual([[String(permission.id), 'edit']])
        const roles = await adapter.findRoles({ names: ['admin'] })
        expect(roles.map((r) => [String(r.id), r.name])).toEqual([[String(role.id), 'admin']])
        for (const name of lookalikes('edit')) {
          for (const p of await adapter.findPermissions({ names: [name] })) expect(p.name, name).toBe(name)
        }
        for (const name of lookalikes('admin')) {
          for (const r of await adapter.findRoles({ names: [name] })) expect(r.name, name).toBe(name)
        }
        expect(await adapter.findPermissions({ names: ['edit'], guardName: 'WEB' })).toEqual([])
        expect(await adapter.findRoles({ names: ['admin'], guardName: 'web ' })).toEqual([])
      })

      it('never gives a subject the links of a lookalike subject id or type', async () => {
        const r = await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
        const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
        const admin = { type: 'user', id: 'admin' }
        await adapter.attachSubjectRoles(admin, [r.id], null)
        await adapter.attachSubjectPermissions(admin, [p.id], null)

        const others = [
          ...lookalikes('admin').map((id) => ({ type: 'user', id })),
          { type: 'USER', id: 'admin' },
          { type: 'user ', id: 'admin' },
        ]
        for (const other of others) {
          expect(await adapter.getSubjectRoleIds(other, null), JSON.stringify(other)).toEqual([])
          expect(await adapter.getSubjectPermissionIds(other, null), JSON.stringify(other)).toEqual([])
        }
        expect(s(await adapter.getSubjectRoleIds(admin, null))).toEqual(s([r.id]))
        expect(s(await adapter.getSubjectIdsWithRoles('user', [r.id], null))).toEqual(['admin'])
        expect(await adapter.getSubjectIdsWithRoles('USER', [r.id], null)).toEqual([])
        expect(await adapter.getSubjectIdsWithPermissions('USER', [p.id], null)).toEqual([])

        // Detaching a lookalike leaves the real subject's links alone.
        for (const other of others) {
          await adapter.detachSubjectRoles(other, undefined, null)
          await adapter.detachSubjectPermissions(other, undefined, null)
        }
        expect(s(await adapter.getSubjectRoleIds(admin, null))).toEqual(s([r.id]))
        expect(s(await adapter.getSubjectPermissionIds(admin, null))).toEqual(s([p.id]))
      })

      if (teams) {
        it('never mixes up lookalike team ids', async () => {
          const r = await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 'acme' })
          const p = await adapter.createPermission({ name: 'edit', guardName: 'web' })
          await adapter.attachSubjectRoles(alice, [r.id], 'acme')
          await adapter.attachSubjectPermissions(alice, [p.id], 'acme')

          for (const team of lookalikes('acme')) {
            expect(await adapter.findRoles({ teamIds: [team] }), team).toEqual([])
            expect(await adapter.getSubjectRoleIds(alice, team), team).toEqual([])
            expect(await adapter.getSubjectPermissionIds(alice, team), team).toEqual([])
            expect(await adapter.getSubjectIdsWithRoles('user', [r.id], team), team).toEqual([])
          }
          expect(await adapter.findRoles({ teamIds: ['acme'] })).toHaveLength(1)
        })
      }

      it('end to end: a lookalike user is denied', async () => {
        const rbac = createRbac({ adapter, cache: false })
        await rbac.createPermission('delete everything')
        await rbac.createRole('admin')
        await rbac.role('admin').givePermissionTo('delete everything')
        await rbac.for({ type: 'user', id: 'admin' }).assignRole('admin')

        expect(await rbac.for({ type: 'user', id: 'admin' }).can('delete everything')).toBe(true)
        for (const id of lookalikes('admin')) {
          expect(await rbac.for({ type: 'user', id }).can('delete everything'), id).toBe(false)
          expect(await rbac.for({ type: 'user', id }).hasRole('admin'), id).toBe(false)
        }
      })
    })

    // Optional methods: an adapter without one skips its tests (the engine falls back or throws a clear error).
    describe('bulk links (optional methods)', () => {
      it('getSubjectLinks: every link of the subject, in every team', async (ctx) => {
        if (!adapter.getSubjectLinks) return ctx.skip()
        const r1 = await adapter.createRole({ name: 'r1', guardName: 'web', teamId: null })
        const r2 = await adapter.createRole({ name: 'r2', guardName: 'api', teamId: null })
        const p = await adapter.createPermission({ name: 'p', guardName: 'web' })
        await adapter.attachSubjectRoles(alice, [r1.id, r2.id], null)
        await adapter.attachSubjectPermissions(alice, [p.id], null)
        if (teams) {
          await adapter.attachSubjectRoles(alice, [r1.id], 7)
          await adapter.attachSubjectPermissions(alice, [p.id], 'acme')
        }
        await adapter.attachSubjectRoles(bob, [r1.id], null)
        await adapter.attachSubjectRoles(robot, [r2.id], null)

        expect(rows(await adapter.getSubjectLinks(alice))).toEqual({
          roles: [row(alice, r1, null), row(alice, r2, null), ...(teams ? [row(alice, r1, 7)] : [])].sort(),
          permissions: [row(alice, p, null), ...(teams ? [row(alice, p, 'acme')] : [])].sort(),
        })
        expect(rows(await adapter.getSubjectLinks(robot))).toEqual({ roles: [row(robot, r2, null)], permissions: [] })
        expect(await adapter.getSubjectLinks(carol)).toEqual({ roles: [], permissions: [] })
      })

      it('getSubjectLinks: never returns the links of a lookalike subject id or type', async (ctx) => {
        if (!adapter.getSubjectLinks) return ctx.skip()
        const admin = { type: 'user', id: 'admin' }
        const others = [...lookalikes('admin').map((id) => ({ type: 'user', id })), { type: 'USER', id: 'admin' }]
        const mine = await adapter.createRole({ name: 'mine', guardName: 'web', teamId: null })
        const p = await adapter.createPermission({ name: 'p', guardName: 'web' })
        await adapter.attachSubjectRoles(admin, [mine.id], null)
        // Each lookalike holds another role, so no primary key (whatever its collation) rejects the link.
        for (const [i, other] of others.entries()) {
          const r = await adapter.createRole({ name: `other ${i}`, guardName: 'web', teamId: null })
          await adapter.attachSubjectRoles(other, [r.id], null)
          await adapter.attachSubjectPermissions(other, [p.id], null)
        }

        expect(rows(await adapter.getSubjectLinks(admin))).toEqual({ roles: [row(admin, mine, null)], permissions: [] })
      })

      if (teams) {
        /** Links in team `acme`, in another team, in the global scope, and in lookalike teams (`ACME`, `acme `, ...). */
        const seedTeams = async () => {
          const owner = await adapter.createRole({ name: 'owner', guardName: 'web', teamId: 'acme' })
          const member = await adapter.createRole({ name: 'member', guardName: 'web', teamId: null })
          const p = await adapter.createPermission({ name: 'p', guardName: 'web' })
          await adapter.attachSubjectRoles(alice, [owner.id, member.id], 'acme')
          await adapter.attachSubjectPermissions(alice, [p.id], 'acme')
          await adapter.attachSubjectRoles(robot, [member.id], 'acme')
          await adapter.attachSubjectRoles(bob, [member.id], null)
          await adapter.attachSubjectRoles(bob, [member.id], 'beta')
          await adapter.attachSubjectPermissions(bob, [p.id], 'beta')
          // One subject per lookalike team, so no primary key (whatever its collation) rejects the link.
          const strangers = lookalikes('acme').map((teamId, i) => ({ subject: { type: 'user', id: 100 + i }, teamId }))
          for (const { subject, teamId } of strangers) {
            await adapter.attachSubjectRoles(subject, [member.id], teamId)
            await adapter.attachSubjectPermissions(subject, [p.id], teamId)
          }
          return { owner, member, p, strangers }
        }

        it('getTeamLinks: every link held in exactly that team, by any subject', async (ctx) => {
          if (!adapter.getTeamLinks) return ctx.skip()
          const { owner, member, p } = await seedTeams()

          expect(rows(await adapter.getTeamLinks('acme'))).toEqual({
            roles: [row(alice, owner, 'acme'), row(alice, member, 'acme'), row(robot, member, 'acme')].sort(),
            permissions: [row(alice, p, 'acme')],
          })
          expect(rows(await adapter.getTeamLinks('beta'))).toEqual({
            roles: [row(bob, member, 'beta')],
            permissions: [row(bob, p, 'beta')],
          })
          expect(await adapter.getTeamLinks('nobody')).toEqual({ roles: [], permissions: [] })
        })

        it('detachTeamLinks: removes the links of exactly that team, and keeps its roles', async (ctx) => {
          if (!adapter.detachTeamLinks) return ctx.skip()
          const { member, p, strangers } = await seedTeams()

          await adapter.detachTeamLinks('acme')

          expect(await adapter.getSubjectRoleIds(alice, 'acme')).toEqual([])
          expect(await adapter.getSubjectPermissionIds(alice, 'acme')).toEqual([])
          expect(await adapter.getSubjectRoleIds(robot, 'acme')).toEqual([])
          expect(s(await adapter.getSubjectRoleIds(bob, null))).toEqual(s([member.id]))
          expect(s(await adapter.getSubjectRoleIds(bob, 'beta'))).toEqual(s([member.id]))
          expect(s(await adapter.getSubjectPermissionIds(bob, 'beta'))).toEqual(s([p.id]))
          for (const { subject, teamId } of strangers) {
            expect(s(await adapter.getSubjectRoleIds(subject, teamId)), teamId).toEqual(s([member.id]))
            expect(s(await adapter.getSubjectPermissionIds(subject, teamId)), teamId).toEqual(s([p.id]))
          }
          expect(await adapter.findRoles({ teamIds: ['acme'] })).toHaveLength(1)

          await adapter.detachTeamLinks('nobody') // no links: a no-op
          expect(s(await adapter.getSubjectRoleIds(bob, 'beta'))).toEqual(s([member.id]))
        })

        // Adapters commonly store the global team as `''`: a team id `''` must never reach the global links.
        it("getTeamLinks / detachTeamLinks never touch the global scope, even for ''", async (ctx) => {
          if (!adapter.getTeamLinks || !adapter.detachTeamLinks) return ctx.skip()
          const { member } = await seedTeams()

          expect(await adapter.getTeamLinks('')).toEqual({ roles: [], permissions: [] })
          await adapter.detachTeamLinks('')
          expect(s(await adapter.getSubjectRoleIds(bob, null))).toEqual(s([member.id]))
        })
      }
    })

    // Expiry: only for adapters that declare `supportsExpiry: true` (the others skip these tests).
    describe('expiry (supportsExpiry)', () => {
      // Whole seconds, so every column precision (MySQL datetime(3), SQLite ms, ...) stores them exactly.
      const T = new Date('2030-01-01T00:00:00.000Z')
      const at = (seconds: number): Date => new Date(T.getTime() + seconds * 1000)
      const ms = (date: Date | null | undefined): number | null =>
        date === undefined || date === null ? null : new Date(date).getTime()
      const expiries = (links: readonly { roleId?: Id; permissionId?: Id; expiresAt?: Date | null | undefined }[]) =>
        links.map((l) => `${String(l.roleId ?? l.permissionId)}:${String(ms(l.expiresAt))}`).sort()

      it('stores expiresAt on attach, and the latest attach wins', async (ctx) => {
        if (adapter.supportsExpiry !== true) return ctx.skip()
        const r1 = await adapter.createRole({ name: 'r1', guardName: 'web', teamId: null })
        const r2 = await adapter.createRole({ name: 'r2', guardName: 'web', teamId: null })
        const p = await adapter.createPermission({ name: 'p', guardName: 'web' })

        await adapter.attachSubjectRoles(alice, [r1.id, r2.id], null, { expiresAt: T })
        await adapter.attachSubjectPermissions(alice, [p.id], null, { expiresAt: T })
        expect(expiries(await adapter.getSubjectRoleLinks!(alice, null))).toEqual(
          [`${String(r1.id)}:${T.getTime()}`, `${String(r2.id)}:${T.getTime()}`].sort(),
        )
        expect(expiries(await adapter.getSubjectPermissionLinks!(alice, null))).toEqual([`${String(p.id)}:${T.getTime()}`])

        // Extend one, make the other permanent: still one row each.
        await adapter.attachSubjectRoles(alice, [r1.id], null, { expiresAt: at(3600) })
        await adapter.attachSubjectRoles(alice, [r2.id], null, { expiresAt: null })
        await adapter.attachSubjectPermissions(alice, [p.id], null, { expiresAt: at(-3600) })
        expect(expiries(await adapter.getSubjectRoleLinks!(alice, null))).toEqual(
          [`${String(r1.id)}:${at(3600).getTime()}`, `${String(r2.id)}:null`].sort(),
        )
        expect(expiries(await adapter.getSubjectPermissionLinks!(alice, null))).toEqual([
          `${String(p.id)}:${at(-3600).getTime()}`,
        ])
        // The id reads keep returning every stored link, expired ones included.
        expect(s(await adapter.getSubjectRoleIds(alice, null))).toEqual(s([r1.id, r2.id]))
        expect(s(await adapter.getSubjectPermissionIds(alice, null))).toEqual(s([p.id]))
        // A plain attach (no options, as a 1.1 engine would call it) writes a permanent link.
        await adapter.attachSubjectRoles(bob, [r1.id], null)
        expect(expiries(await adapter.getSubjectRoleLinks!(bob, null))).toEqual([`${String(r1.id)}:null`])
        expect(await adapter.getSubjectRoleLinks!(carol, null)).toEqual([])
      })

      it('keeps expiry per subject and per team, and never touches a lookalike subject', async (ctx) => {
        if (adapter.supportsExpiry !== true) return ctx.skip()
        const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
        const admin = { type: 'user', id: 'admin' }
        await adapter.attachSubjectRoles(admin, [r.id], null, { expiresAt: null })
        for (const id of lookalikes('admin')) {
          // Under a collation that ignores case or trailing spaces the primary key rejects this link; either
          // way, the exact subject's link must stay permanent.
          await adapter.attachSubjectRoles({ type: 'user', id }, [r.id], null, { expiresAt: T })
          for (const link of await adapter.getSubjectRoleLinks!({ type: 'user', id }, null)) {
            expect(String(link.subject.id)).toBe(id)
          }
        }
        expect(expiries(await adapter.getSubjectRoleLinks!(admin, null))).toEqual([`${String(r.id)}:null`])
        if (teams) {
          await adapter.attachSubjectRoles(alice, [r.id], 'acme', { expiresAt: T })
          await adapter.attachSubjectRoles(alice, [r.id], null, { expiresAt: at(60) })
          expect(expiries(await adapter.getSubjectRoleLinks!(alice, 'acme'))).toEqual([`${String(r.id)}:${T.getTime()}`])
          expect(expiries(await adapter.getSubjectRoleLinks!(alice, null))).toEqual([`${String(r.id)}:${at(60).getTime()}`])
          expect(team((await adapter.getSubjectRoleLinks!(alice, 'acme'))[0]!.teamId)).toBe('acme')
        }
      })

      it('reverse lookups skip links expired at `now`', async (ctx) => {
        if (adapter.supportsExpiry !== true) return ctx.skip()
        const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
        const p = await adapter.createPermission({ name: 'p', guardName: 'web' })
        await adapter.attachSubjectRoles(alice, [r.id], null, { expiresAt: T })
        await adapter.attachSubjectRoles(bob, [r.id], null, { expiresAt: null })
        await adapter.attachSubjectPermissions(alice, [p.id], null, { expiresAt: T })

        expect(s(await adapter.getSubjectIdsWithRoles('user', [r.id], null, { now: at(-1) }))).toEqual(['1', '2'])
        expect(s(await adapter.getSubjectIdsWithRoles('user', [r.id], null, { now: T }))).toEqual(['2'])
        expect(s(await adapter.getSubjectIdsWithRoles('user', [r.id], null))).toEqual(['1', '2'])
        expect(s(await adapter.getSubjectIdsWithPermissions('user', [p.id], null, { now: at(-1) }))).toEqual(['1'])
        expect(await adapter.getSubjectIdsWithPermissions('user', [p.id], null, { now: at(1) })).toEqual([])
      })

      it('getSubjectLinks / getTeamLinks carry expiresAt', async (ctx) => {
        if (adapter.supportsExpiry !== true || !adapter.getSubjectLinks) return ctx.skip()
        const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
        const p = await adapter.createPermission({ name: 'p', guardName: 'web' })
        const scope = teams ? 'acme' : null
        await adapter.attachSubjectRoles(alice, [r.id], scope, { expiresAt: T })
        await adapter.attachSubjectPermissions(alice, [p.id], scope, { expiresAt: null })
        const links = await adapter.getSubjectLinks(alice)
        expect(expiries(links.roles)).toEqual([`${String(r.id)}:${T.getTime()}`])
        expect(expiries(links.permissions)).toEqual([`${String(p.id)}:null`])
        if (teams && adapter.getTeamLinks) {
          const teamLinks = await adapter.getTeamLinks('acme')
          expect(expiries(teamLinks.roles)).toEqual([`${String(r.id)}:${T.getTime()}`])
          expect(expiries(teamLinks.permissions)).toEqual([`${String(p.id)}:null`])
        }
      })

      it('deleteExpiredLinks removes only links expired at `now`, of every subject and team', async (ctx) => {
        if (adapter.supportsExpiry !== true || !adapter.deleteExpiredLinks) return ctx.skip()
        const r1 = await adapter.createRole({ name: 'r1', guardName: 'web', teamId: null })
        const r2 = await adapter.createRole({ name: 'r2', guardName: 'api', teamId: null })
        const p = await adapter.createPermission({ name: 'p', guardName: 'web' })
        const scope = teams ? 7 : null
        await adapter.attachSubjectRoles(alice, [r1.id], null, { expiresAt: at(-10) })
        await adapter.attachSubjectRoles(alice, [r2.id], null, { expiresAt: T })
        await adapter.attachSubjectRoles(bob, [r1.id], scope, { expiresAt: at(10) })
        await adapter.attachSubjectRoles(carol, [r1.id], null)
        await adapter.attachSubjectPermissions(robot, [p.id], scope, { expiresAt: at(-1) })
        await adapter.attachSubjectPermissions(alice, [p.id], null, { expiresAt: null })

        expect(await adapter.deleteExpiredLinks(T)).toEqual({ roles: 2, permissions: 1 })
        expect(await adapter.getSubjectRoleIds(alice, null)).toEqual([])
        expect(s(await adapter.getSubjectRoleIds(bob, scope))).toEqual(s([r1.id]))
        expect(s(await adapter.getSubjectRoleIds(carol, null))).toEqual(s([r1.id]))
        expect(await adapter.getSubjectPermissionIds(robot, scope)).toEqual([])
        expect(s(await adapter.getSubjectPermissionIds(alice, null))).toEqual(s([p.id]))
        expect(await adapter.deleteExpiredLinks(T)).toEqual({ roles: 0, permissions: 0 })
      })

      it('end to end: checks, queries and pruning follow the engine clock', async (ctx) => {
        if (adapter.supportsExpiry !== true) return ctx.skip()
        let now = at(-3600)
        const rbac = createRbac({ adapter, teams, cache: false, now: () => now })
        await rbac.createPermission('impersonate')
        await rbac.createPermission('read')
        await rbac.createRole('on-call')
        await rbac.role('on-call').givePermissionTo('read')
        const user = rbac.for(alice)
        await user.assignRole('on-call', { expiresAt: T })
        await user.givePermissionTo('impersonate', { expiresAt: at(-1800) })

        expect(await user.hasRole('on-call')).toBe(true)
        expect(await user.can('read')).toBe(true)
        expect(await user.can('impersonate')).toBe(true)
        expect((await user.getRoleAssignments()).map((a) => ms(a.expiresAt))).toEqual([T.getTime()])
        expect(s(await rbac.subjectsWithPermission('user', 'impersonate'))).toEqual(['1'])

        now = at(-1800)
        expect(await user.can('impersonate')).toBe(false)
        expect(await rbac.subjectsWithPermission('user', 'impersonate')).toEqual([])
        expect(await user.can('read')).toBe(true)

        now = T
        expect(await user.hasRole('on-call')).toBe(false)
        expect(await user.can('read')).toBe(false)
        expect(await rbac.subjectsWithRole('user', 'on-call')).toEqual([])
        expect(await user.snapshot()).toEqual({ roles: [], permissions: [] })

        if (adapter.deleteExpiredLinks) expect(await rbac.pruneExpired()).toEqual({ roles: 1, permissions: 1 })
        // Assigning again (no expiry) makes the role permanent.
        await user.assignRole('on-call')
        now = at(10 * 365 * 24 * 3600)
        expect(await user.hasRole('on-call')).toBe(true)
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

      it('revokeAll() removes the roles and direct permissions of the guard, then of every guard', async () => {
        const rbac = createRbac({ adapter, teams, cache: false })
        await rbac.createPermission('edit')
        await rbac.createPermission('call', { guard: 'api' })
        await rbac.createRole('writer')
        await rbac.createRole('bot', { guard: 'api' })
        const web = rbac.for(alice)
        const api = rbac.for(alice, { guard: 'api' })
        await web.assignRole('writer')
        await web.givePermissionTo('edit')
        await api.assignRole('bot')
        await api.givePermissionTo('call')
        await rbac.for(bob).assignRole('writer')

        await web.revokeAll()
        expect(await web.getRoleNames()).toEqual([])
        expect(await web.getDirectPermissions()).toEqual([])
        expect(await api.getRoleNames()).toEqual(['bot'])
        expect(await rbac.for(bob).getRoleNames()).toEqual(['writer'])

        await web.revokeAll({ allGuards: true })
        expect(await api.getRoleNames()).toEqual([])
        expect(await api.getDirectPermissions()).toEqual([])
        expect(await rbac.for(bob).getRoleNames()).toEqual(['writer'])
      })

      if (teams) {
        it('teams(), deleteTeam() and revokeAll({ allTeams: true })', async (ctx) => {
          if (!adapter.getSubjectLinks || !adapter.getTeamLinks) return ctx.skip()
          const rbac = createRbac({ adapter, teams: true, cache: false })
          await rbac.createPermission('edit')
          await rbac.createRole('member')
          await rbac.createRole('owner', { team: 'acme' })
          await rbac.for(alice, { team: 'acme' }).assignRole('owner', 'member')
          await rbac.for(alice, { team: 'beta' }).givePermissionTo('edit')
          await rbac.for(alice).assignRole('member')
          await rbac.for(bob, { team: 'acme' }).assignRole('member')

          expect(s(await rbac.for(alice).teams())).toEqual(['acme', 'beta'])
          expect(s(await rbac.for(bob).teams())).toEqual(['acme'])

          await rbac.deleteTeam('acme')
          expect(s(await rbac.for(alice).teams())).toEqual(['beta'])
          expect(await rbac.for(bob).teams()).toEqual([])
          expect(await rbac.findRole('owner', { team: 'acme' })).toBeNull()
          expect(await rbac.findRole('member')).not.toBeNull()
          expect(await rbac.for(alice).getRoleNames()).toEqual(['member'])

          await rbac.for(alice).revokeAll({ allTeams: true })
          expect(await rbac.for(alice).teams()).toEqual([])
          expect(await rbac.for(alice).getRoleNames()).toEqual([])
        })
      }
    })
  })
}
