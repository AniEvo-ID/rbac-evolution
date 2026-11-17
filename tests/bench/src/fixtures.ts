import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createClient } from '@libsql/client'
import { createRbac, MemoryAdapter, type RbacAdapter } from '@anievo-id/rbac-evolution'
import { drizzleSqliteAdapter } from '@anievo-id/rbac-evolution-drizzle/sqlite'
import { drizzle } from 'drizzle-orm/libsql'

/** Subjects in the reverse-lookup data set: one role link each, so 100k links. */
export const SUBJECTS = Number(process.env['BENCH_SUBJECTS'] ?? 100_000)
/** Roles in the data set; subject `n` gets role `role-(n % ROLES)`. */
export const ROLES = 20
/** Permissions per role (`perm-<role>-<i>`), plus one shared `shared.read` on every role. */
export const PERMISSIONS_PER_ROLE = 10

export type Backend = 'memory' | 'sqlite'

const require = createRequire(import.meta.url)
const sqliteDdl = readFileSync(require.resolve('@anievo-id/rbac-evolution-drizzle/sql/sqlite.sql'), 'utf8')

async function adapterFor(backend: Backend): Promise<{ adapter: RbacAdapter; bulkLinks?: (n: number) => Promise<void> }> {
  if (backend === 'memory') return { adapter: new MemoryAdapter() }
  const client = createClient({ url: ':memory:' })
  await client.executeMultiple(sqliteDdl)
  return {
    adapter: drizzleSqliteAdapter(drizzle(client)),
    // One INSERT ... SELECT over a recursive series: seeding 100k links through the adapter would take minutes.
    bulkLinks: async (n) => {
      await client.execute({
        sql: `WITH RECURSIVE s(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM s WHERE n + 1 < ?)
              INSERT INTO model_has_roles (role_id, subject_type, subject_id, team_id)
              SELECT r.id, 'user', CAST(s.n AS TEXT), '' FROM s JOIN roles r ON r.name = 'role-' || (s.n % ?)`,
        args: [BigInt(n), BigInt(ROLES)], // BigInt binds as INTEGER: a JS number is a REAL, and `role-3.0` matches no role
      })
    },
  }
}

/**
 * An engine with ROLES roles of PERMISSIONS_PER_ROLE + 1 permissions each, and `subjects` users holding one role
 * each. `cache: false` measures every call against the adapter.
 */
export async function seeded(backend: Backend, subjects: number, options: { cache: boolean }) {
  const { adapter, bulkLinks } = await adapterFor(backend)
  const rbac = createRbac({ adapter, ...(options.cache ? {} : { cache: false }) })
  await rbac.createPermission('shared.read')
  for (let r = 0; r < ROLES; r++) {
    const names = Array.from({ length: PERMISSIONS_PER_ROLE }, (_, i) => `perm-${r}-${i}`)
    for (const name of names) await rbac.createPermission(name)
    await rbac.createRole(`role-${r}`)
    await rbac.role(`role-${r}`).givePermissionTo(...names, 'shared.read')
  }
  if (bulkLinks) {
    await bulkLinks(subjects)
  } else {
    const byName = new Map((await adapter.findRoles({ guardName: 'web' })).map((r) => [r.name, r]))
    const roles = Array.from({ length: ROLES }, (_, r) => byName.get(`role-${r}`))
    for (let n = 0; n < subjects; n++) {
      const role = roles[n % ROLES]
      if (!role) throw new Error('role missing')
      await adapter.attachSubjectRoles({ type: 'user', id: String(n) }, [role.id], null)
    }
  }
  return rbac
}
