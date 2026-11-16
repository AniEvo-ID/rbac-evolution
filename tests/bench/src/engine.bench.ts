// Engine benchmarks: `pnpm --filter rbac-evolution-bench bench` (or the "Benchmarks" workflow).
// Data sets are seeded with top-level await: vitest 2's bench mode doesn't run beforeAll hooks inside describe().
// BENCH_SUBJECTS overrides the 100k subjects of the reverse-lookup data set.
import { bench, describe } from 'vitest'
import { type Backend, ROLES, SUBJECTS, seeded } from './fixtures'

/** Subjects for can() and syncRoles(): they read or write one subject's links, so the table size barely matters. */
const SMALL = 1000

for (const backend of ['memory', 'sqlite'] as const satisfies readonly Backend[]) {
  const cold = await seeded(backend, SMALL, { cache: false })
  const cached = await seeded(backend, SMALL, { cache: true })
  const writes = await seeded(backend, SMALL, { cache: true })
  const large = await seeded(backend, SUBJECTS, { cache: false })

  // Fail loudly here instead of inside bench(), where vitest 2 swallows errors and reports 0 samples.
  const expected = SUBJECTS / ROLES
  const found = (await large.subjectsWithRole('user', 'role-3')).length
  if (Math.abs(found - expected) > 1) throw new Error(`${backend}: expected ~${expected} subjects with role-3, got ${found}`)
  if (!(await cached.for({ type: 'user', id: '1' }).can('shared.read'))) throw new Error(`${backend}: seed is broken`)

  describe(`${backend}: can()`, () => {
    let n = 0
    bench('cold (cache: false), a different subject each call', async () => {
      await cold.for({ type: 'user', id: String(n++ % SMALL) }).can('shared.read')
    })
    bench('cached, same subject, allowed', async () => {
      await cached.for({ type: 'user', id: '1' }).can('shared.read')
    })
    bench('cached, same subject, denied', async () => {
      await cached.for({ type: 'user', id: '1' }).can('perm-0-0')
    })
  })

  describe(`${backend}: syncRoles()`, () => {
    let n = 0
    bench('replace a subject\'s roles with two others', async () => {
      const i = n++
      await writes.for({ type: 'user', id: String(i % SMALL) }).syncRoles(`role-${i % ROLES}`, `role-${(i + 1) % ROLES}`)
    })
  })

  describe(`${backend}: reverse lookups on ${SUBJECTS.toLocaleString('en')} role links`, () => {
    bench(`subjectsWithRole (1 of ${ROLES} roles)`, async () => {
      await large.subjectsWithRole('user', 'role-3')
    })
    bench('subjectsWithPermission (a permission on one role)', async () => {
      await large.subjectsWithPermission('user', 'perm-3-0')
    })
    bench('subjectsWithPermission (a permission on every role: all subjects)', async () => {
      await large.subjectsWithPermission('user', 'shared.read')
    })
  })
}
