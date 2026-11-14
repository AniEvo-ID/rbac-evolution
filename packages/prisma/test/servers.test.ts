// Optional suites against real database servers (CI provides both); each is skipped when its env var is absent.
// - PG_URL    → client generated into test/generated-pg     (provider "postgresql")
// - MYSQL_URL → client generated into test/generated-mysql  (provider "mysql")
// `node test/prepare.mjs` (run by `pnpm test`) generates both clients and, when the env var is set,
// pushes the shipped models into a dedicated database on that server.
import { createRbac } from '@anievo-id/rbac-evolution'
import { runAdapterTests } from '@anievo-id/rbac-evolution/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaAdapter, type PrismaRbacClient } from '../src'
import { PrismaClient as MysqlPrismaClient } from './generated-mysql'
import { PrismaClient as PgPrismaClient } from './generated-pg'

/** Keep in sync with test/prepare.mjs. */
const TEST_DATABASE = 'rbac_evolution_prisma_test'
const withDatabase = (url: string, database: string): string => {
  const u = new URL(url)
  u.pathname = `/${database}`
  return u.toString()
}

type ServerClient = PrismaRbacClient & { $disconnect(): Promise<void> }

function serverSuite(label: string, envVar: string, connect: (url: string) => ServerClient): void {
  const url = process.env[envVar] ?? ''
  const title = `PrismaAdapter on ${label} (real server)${url === '' ? ` (skipped: ${envVar} not set)` : ''}`

  describe.skipIf(url === '')(title, () => {
    let prisma: ServerClient

    beforeAll(() => {
      prisma = connect(withDatabase(url, TEST_DATABASE))
    })

    afterAll(async () => {
      await prisma?.$disconnect()
    })

    const reset = async (): Promise<void> => {
      await prisma.$transaction([
        prisma.rbacModelHasPermission.deleteMany({ where: {} }),
        prisma.rbacModelHasRole.deleteMany({ where: {} }),
        prisma.rbacRoleHasPermission.deleteMany({ where: {} }),
        prisma.rbacRole.deleteMany({ where: {} }),
        prisma.rbacPermission.deleteMany({ where: {} }),
      ])
    }

    runAdapterTests(`PrismaAdapter (${label})`, async () => {
      await reset()
      return new PrismaAdapter(prisma)
    })

    runAdapterTests(`PrismaAdapter (${label}, skipDuplicates)`, async () => {
      await reset()
      return new PrismaAdapter(prisma, { skipDuplicates: true })
    })

    describe(`PrismaAdapter (${label}): specifics`, () => {
      const alice = { type: 'user', id: 1 }

      for (const skipDuplicates of [false, true]) {
        it(`is idempotent under concurrent attaches (skipDuplicates: ${skipDuplicates})`, async () => {
          await reset()
          const adapter = new PrismaAdapter(prisma, { skipDuplicates })
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
      }

      it('enforces unique (name, guard_name, team_id) including the global team', async () => {
        await reset()
        const adapter = new PrismaAdapter(prisma)
        await adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })
        await adapter.createRole({ name: 'admin', guardName: 'web', teamId: 1 })
        await expect(adapter.createRole({ name: 'admin', guardName: 'web', teamId: null })).rejects.toMatchObject({
          code: 'P2002',
        })
      })

      it('works end-to-end with createRbac({ teams: true })', async () => {
        await reset()
        const rbac = createRbac({ adapter: new PrismaAdapter(prisma), teams: true, cache: false })
        await rbac.createPermission('manage billing')
        await rbac.createRole('admin')
        await rbac.role('admin').givePermissionTo('manage billing')
        await rbac.for(alice, { team: 1 }).assignRole('admin')

        expect(await rbac.for(alice, { team: 1 }).can('manage billing')).toBe(true)
        expect(await rbac.for(alice, { team: 2 }).can('manage billing')).toBe(false)
      })
    })
  })
}

serverSuite('PostgreSQL', 'PG_URL', (url) => new PgPrismaClient({ datasourceUrl: url }))
serverSuite('MySQL', 'MYSQL_URL', (url) => new MysqlPrismaClient({ datasourceUrl: url }))
