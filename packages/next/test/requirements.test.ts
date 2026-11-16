import { describe, expect, it } from 'vitest'
import { snapshotSatisfies } from '../src/snapshot'
import { checkRequirement, requirementGroups } from '../src/types'

const perms = new Set(['edit', 'publish'])
const roles = new Set(['writer'])
const check = (req: Parameters<typeof checkRequirement>[0]) =>
  checkRequirement(req, (n) => perms.has(n), (n) => roles.has(n))
const snapshot = { roles: [...roles], permissions: [...perms] }

describe('requirementGroups', () => {
  it('splits pipes and groups per entry with all', () => {
    expect(requirementGroups('a|b', false)).toEqual([['a', 'b']])
    expect(requirementGroups(['a', 'b|c'], false)).toEqual([['a', 'b', 'c']])
    expect(requirementGroups(['a', 'b|c'], true)).toEqual([['a'], ['b', 'c']])
  })
})

describe.each([
  ['engine checker', check],
  ['snapshot', async (req: Parameters<typeof checkRequirement>[0]) => snapshotSatisfies(snapshot, req)],
])('%s', (_name, run) => {
  it("treats 'a|b' strings as any (they used to be looked up as one name)", async () => {
    expect(await run({ permission: 'delete|edit' })).toBe(true)
    expect(await run({ role: 'admin | writer' })).toBe(true)
    expect(await run({ roleOrPermission: 'admin|publish' })).toBe(true)
  })

  it('arrays mean any by default, like spatie canAny()', async () => {
    expect(await run({ permission: ['delete', 'edit'] })).toBe(true)
    expect(await run({ permission: ['delete', 'archive'] })).toBe(false)
  })

  it('all: true requires every entry, like spatie canAll(); pipes stay OR inside an entry', async () => {
    expect(await run({ permission: ['edit', 'publish'], all: true })).toBe(true)
    expect(await run({ permission: ['edit', 'delete'], all: true })).toBe(false)
    expect(await run({ permission: ['edit', 'delete|publish'], all: true })).toBe(true)
    expect(await run({ role: ['writer', 'admin'], all: true })).toBe(false)
  })

  it('empty requirements deny', async () => {
    expect(await run({ permission: [] })).toBe(false)
    expect(await run({ permission: ' | ' })).toBe(false)
    expect(await run({ permission: [], all: true })).toBe(false)
  })
})

describe('matchPath', async () => {
  const { matchPath } = await import('../src/matcher')
  it('protects percent-encoded paths', () => {
    expect(matchPath('/admin/:path*', '/%61dmin')).toBe(true)
    expect(matchPath('/admin/:path*', '/%61dmin/users')).toBe(true)
    expect(matchPath('/admin/:path*', '/%E0%A4%A')).toBe(false) // malformed: raw path only
  })
  it('is stable with stateful /g regexes', () => {
    const re = /^\/admin/g
    expect([1, 2, 3].map(() => matchPath(re, '/admin'))).toEqual([true, true, true])
  })
})

describe('snapshotSatisfies with snapshot.denied', () => {
  const root = { roles: ['root'], permissions: ['audit.*'], denied: [' audit.delete'] }
  const options = { superAdminRoles: ['root'], wildcard: true }

  it('denies the names the before hook denied, even to a super-admin', () => {
    expect(snapshotSatisfies(root, { permission: 'audit.delete' }, options)).toBe(false)
    expect(snapshotSatisfies(root, { permission: 'audit.view' }, options)).toBe(true)
    expect(snapshotSatisfies(root, { permission: ['audit.delete', 'audit.view'] }, options)).toBe(true)
    expect(snapshotSatisfies(root, { permission: ['audit.delete', 'audit.view'], all: true }, options)).toBe(false)
    expect(snapshotSatisfies(root, { roleOrPermission: 'audit.delete' }, options)).toBe(false)
  })

  it('behaves as before without denied', () => {
    const { denied: _, ...old } = root
    expect(snapshotSatisfies(old, { permission: 'audit.delete' }, options)).toBe(true)
  })
})
