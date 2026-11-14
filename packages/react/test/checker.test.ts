import { describe, expect, it } from 'vitest'
import { createRbacChecker } from '../src'

const snapshot = { roles: ['writer', 'reviewer'], permissions: ['articles.edit', 'articles.view', 'comments.*'] }

describe('createRbacChecker', () => {
  it('checks exact permissions', () => {
    const rbac = createRbacChecker(snapshot)
    expect(rbac.can('articles.edit')).toBe(true)
    expect(rbac.can(' articles.edit ')).toBe(true)
    expect(rbac.can('articles.delete')).toBe(false)
    expect(rbac.cannot('articles.delete')).toBe(true)
    // without wildcard, `comments.*` is just a name
    expect(rbac.can('comments.delete')).toBe(false)
    expect(rbac.can('')).toBe(false)
  })

  it('supports wildcard matching via core', () => {
    const rbac = createRbacChecker(snapshot, { wildcard: true })
    expect(rbac.can('comments.delete')).toBe(true)
    expect(rbac.can('comments.delete.own')).toBe(true)
    expect(rbac.can('articles.delete')).toBe(false)
    expect(rbac.can('articles.*')).toBe(false)
    expect(rbac.can('bad..name')).toBe(false)
  })

  it('canAny / canAll', () => {
    const rbac = createRbacChecker(snapshot)
    expect(rbac.canAny('articles.delete', 'articles.view')).toBe(true)
    expect(rbac.canAny(['articles.delete', 'x'])).toBe(false)
    expect(rbac.canAll(['articles.edit', 'articles.view'])).toBe(true)
    expect(rbac.canAll('articles.edit', ['articles.delete'])).toBe(false)
    expect(rbac.canAny([])).toBe(false)
    expect(rbac.canAll([])).toBe(false)
    expect(rbac.hasAllRoles([])).toBe(false)
  })

  it('role checks', () => {
    const rbac = createRbacChecker(snapshot)
    expect(rbac.hasRole('writer')).toBe(true)
    expect(rbac.hasRole(['admin', 'reviewer'])).toBe(true)
    expect(rbac.hasRole('admin')).toBe(false)
    expect(rbac.hasAnyRole('admin', 'writer')).toBe(true)
    expect(rbac.hasAllRoles('writer', 'reviewer')).toBe(true)
    expect(rbac.hasAllRoles(['writer', 'admin'])).toBe(false)
  })

  it('super admin roles pass every permission check', () => {
    const rbac = createRbacChecker({ roles: ['admin'], permissions: [] }, { superAdminRoles: ['admin'] })
    expect(rbac.isSuperAdmin).toBe(true)
    expect(rbac.can('anything')).toBe(true)
    expect(rbac.canAll('a', 'b')).toBe(true)
    expect(rbac.hasRole('writer')).toBe(false)
  })

  it('treats a missing snapshot as a guest', () => {
    const rbac = createRbacChecker(null)
    expect(rbac.can('articles.edit')).toBe(false)
    expect(rbac.hasRole('writer')).toBe(false)
    expect(rbac.roles).toEqual([])
  })
})

describe('loading', () => {
  it('denies every check, cannot included, and ignores a stale snapshot', () => {
    const stale = createRbacChecker({ roles: ['admin'], permissions: ['x'] }, { loading: true, superAdminRoles: ['admin'] })
    expect(stale.loading).toBe(true)
    expect(stale.can('x')).toBe(false)
    expect(stale.cannot('x')).toBe(false)
    expect(stale.cannot('y')).toBe(false)
    expect(stale.canAny('x')).toBe(false)
    expect(stale.hasRole('admin')).toBe(false)
    expect(stale.isSuperAdmin).toBe(false)
    expect(createRbacChecker(null, { loading: true }).cannot('billing')).toBe(false)
  })
})
