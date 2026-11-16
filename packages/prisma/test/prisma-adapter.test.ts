import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaAdapter, type PrismaRbacClient } from '../src'
import { connect, databaseUrl } from './generated/connect'
import { connect as connectLegacy, databaseUrl as legacyUrl } from './generated-legacy/connect'

// `test/generated` + `test/.tmp/test.db` are created by `node test/prepare.mjs` (run by `pnpm test`).
// `connect` builds the client the way the installed Prisma wants it (a driver adapter on Prisma 7).
const prisma = connect(databaseUrl)
// The same models without `expiresAt`, on their own database: a schema that was never upgraded (1.1).
const legacy = connectLegacy(legacyUrl)

afterAll(async () => {
  await prisma.$disconnect()
  await legacy.$disconnect()
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

runAdapterTests('PrismaAdapter ({ expiry: true })', async () => {
  await resetDatabase()
  return new PrismaAdapter(prisma, { expiry: true })
})

async function resetLegacy(): Promise<void> {
  await legacy.$transaction([
    legacy.rbacModelHasPermission.deleteMany(),
    legacy.rbacModelHasRole.deleteMany(),
    legacy.rbacRoleHasPermission.deleteMany(),
    legacy.rbacRole.deleteMany(),
    legacy.rbacPermission.deleteMany(),
  ])
}

runAdapterTests('PrismaAdapter on a 1.1 schema (no expiresAt)', async () => {
  await resetLegacy()
  return new PrismaAdapter(legacy)
})

describe('PrismaAdapter on a 1.1 schema (no expiresAt)', () => {
  it('works as in 1.1 and refuses an expiresAt instead of granting permanent access', async () => {
    await resetLegacy()
    const rbac = createRbac({ adapter: new PrismaAdapter(legacy), cache: false })
    await rbac.createRole('on-call')
    await rbac.for({ type: 'user', id: 1 }).assignRole('on-call')
    expect(await rbac.for({ type: 'user', id: 1 }).getRoleAssignments()).toEqual([
      { role: expect.objectContaining({ name: 'on-call' }), expiresAt: null },
    ])
    await expect(
      rbac.for({ type: 'user', id: 2 }).assignRole('on-call', { expiresAt: new Date(Date.now() + 60_000) }),
    ).rejects.toMatchObject({ code: 'EXPIRY_NOT_SUPPORTED' })
    expect(await legacy.rbacModelHasRole.count()).toBe(1)
    expect(await rbac.pruneExpired()).toEqual({ roles: 0, permissions: 0 })
  })

  it('with { expiry: true } but no column, fails loudly on the first write', async () => {
    await resetLegacy()
    const rbac = createRbac({ adapter: new PrismaAdapter(legacy, { expiry: true }), cache: false })
    await rbac.createRole('on-call')
    await expect(
      rbac.for({ type: 'user', id: 1 }).assignRole('on-call', { expiresAt: new Date(Date.now() + 60_000) }),
    ).rejects.toThrow(/expiresAt/)
    expect(await legacy.rbacModelHasRole.count()).toBe(0)
  })
})

describe('PrismaAdapter ({ expiry: true }) specifics', () => {
  it('needs updateMany on the link delegates', async () => {
    await resetDatabase()
    const client = {
      ...prisma,
      rbacPermission: prisma.rbacPermission,
      rbacRole: prisma.rbacRole,
      rbacRoleHasPermission: prisma.rbacRoleHasPermission,
      rbacModelHasPermission: prisma.rbacModelHasPermission,
      rbacModelHasRole: {
        findMany: prisma.rbacModelHasRole.findMany.bind(prisma.rbacModelHasRole),
        createMany: prisma.rbacModelHasRole.createMany.bind(prisma.rbacModelHasRole),
        deleteMany: prisma.rbacModelHasRole.deleteMany.bind(prisma.rbacModelHasRole),
        create: prisma.rbacModelHasRole.create.bind(prisma.rbacModelHasRole),
        groupBy: prisma.rbacModelHasRole.groupBy.bind(prisma.rbacModelHasRole),
      },
    } as unknown as PrismaRbacClient
    const adapter = new PrismaAdapter(client, { expiry: true })
    const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
    await expect(
      adapter.attachSubjectRoles({ type: 'user', id: 1 }, [r.id], null, { expiresAt: new Date() }),
    ).rejects.toThrow(/updateMany/)
  })

  it('stores and filters by expires_at in the database', async () => {
    await resetDatabase()
    const adapter = new PrismaAdapter(prisma, { expiry: true })
    const r = await adapter.createRole({ name: 'r', guardName: 'web', teamId: null })
    const at = new Date('2030-01-01T00:00:00Z')
    await adapter.attachSubjectRoles({ type: 'user', id: 1 }, [r.id], null, { expiresAt: at })
    const [row] = await prisma.rbacModelHasRole.findMany()
    expect(row!.expiresAt).toEqual(at)
    // Without expiry, the adapter never writes the column: new links are NULL (permanent).
    await new PrismaAdapter(prisma).attachSubjectRoles({ type: 'user', id: 2 }, [r.id], null)
    expect((await prisma.rbacModelHasRole.findMany({ where: { subjectId: '2' } }))[0]!.expiresAt).toBeNull()
  })
})

describe('PrismaAdapter on an interactive-transaction client', () => {
  it('deletes roles and permissions inside prisma.$transaction(async (tx) => ...)', async () => {
    await resetDatabase()
    const rbac = createRbac({ adapter: new PrismaAdapter(prisma), cache: false })
    await rbac.createPermission('edit')
    await rbac.createRole('writer')
    await rbac.role('writer').givePermissionTo('edit')
    await rbac.for({ type: 'user', id: 1 }).assignRole('writer')

    await prisma.$transaction(async (tx) => {
      const inTx = createRbac({ adapter: new PrismaAdapter(tx), cache: false })
      await inTx.deleteRole('writer')
      await inTx.deletePermission('edit')
    })

    expect(await prisma.rbacRole.count()).toBe(0)
    expect(await prisma.rbacPermission.count()).toBe(0)
    expect(await prisma.rbacModelHasRole.count()).toBe(0)
    expect(await prisma.rbacRoleHasPermission.count()).toBe(0)
  })

  // Prisma 7 keeps `$transaction` on `tx` (nested transactions). The deletes must still run on `tx`, inside the
  // outer transaction, not in a batch transaction of their own.
  it('runs the deletes inside the outer transaction, which can roll them back', async () => {
    await resetDatabase()
    const rbac = createRbac({ adapter: new PrismaAdapter(prisma), cache: false })
    await rbac.createRole('writer')
    await rbac.for({ type: 'user', id: 1 }).assignRole('writer')

    await expect(
      prisma.$transaction(async (tx) => {
        await createRbac({ adapter: new PrismaAdapter(tx), cache: false }).deleteRole('writer')
        expect(await tx.rbacRole.count()).toBe(0)
        throw new Error('roll back')
      }),
    ).rejects.toThrow('roll back')

    expect(await prisma.rbacRole.count()).toBe(1)
    expect(await prisma.rbacModelHasRole.count()).toBe(1)
  })
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
