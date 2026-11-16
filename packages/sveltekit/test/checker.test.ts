import { describe, expect, it } from 'vitest'
import { createRbacChecker, createRbacState } from '../src/index.js'

describe('createRbacChecker', () => {
  it('checks permissions: a list means all, canAny means any, empty lists deny', () => {
    const rbac = createRbacChecker({ roles: ['writer'], permissions: ['articles.edit', ' articles.view '] })
    expect(rbac.isGuest).toBe(false)
    expect(rbac.can('articles.edit')).toBe(true)
    expect(rbac.can(' articles.view')).toBe(true)
    expect(rbac.can(['articles.edit', 'articles.view'])).toBe(true)
    expect(rbac.can(['articles.edit', 'articles.delete'])).toBe(false)
    expect(rbac.cannot('articles.delete')).toBe(true)
    expect(rbac.canAny(['articles.delete', 'articles.edit'])).toBe(true)
    expect(rbac.canAny([])).toBe(false)
    expect(rbac.canAll([])).toBe(false)
    expect(rbac.can('')).toBe(false)
    // Pipes are not split for permissions (like the Vue package): `'a|b'` is one name.
    expect(rbac.can('articles.edit|articles.view')).toBe(false)
  })

  it('checks roles: any by default, pipes, hasAllRoles', () => {
    const rbac = createRbacChecker({ roles: ['writer', 'editor'], permissions: [] })
    expect(rbac.hasRole('writer')).toBe(true)
    expect(rbac.hasRole('admin|editor')).toBe(true)
    expect(rbac.hasRole(['admin', 'writer'])).toBe(true)
    expect(rbac.hasAnyRole('admin')).toBe(false)
    expect(rbac.hasAllRoles(['writer', 'editor'])).toBe(true)
    expect(rbac.hasAllRoles('writer|admin')).toBe(false)
    expect(rbac.hasAllRoles([])).toBe(false)
  })

  it('treats null / undefined as a guest that has nothing', () => {
    for (const snapshot of [null, undefined]) {
      const rbac = createRbacChecker(snapshot, { superAdminRoles: ['super-admin'] })
      expect(rbac.isGuest).toBe(true)
      expect(rbac.snapshot).toEqual({ roles: [], permissions: [] })
      expect(rbac.can('anything')).toBe(false)
      expect(rbac.hasRole('super-admin')).toBe(false)
      expect(rbac.isSuperAdmin()).toBe(false)
    }
    // A typo in a prop binding (`null` names) denies too.
    expect(createRbacChecker({ roles: ['a'], permissions: ['b'] }).can(null as unknown as string)).toBe(false)
  })

  it('matches wildcards only with wildcard: true, and ignores invalid patterns', () => {
    const snapshot = { roles: [], permissions: ['articles.*', 'bad..pattern'] }
    expect(createRbacChecker(snapshot).can('articles.edit')).toBe(false)
    const rbac = createRbacChecker(snapshot, { wildcard: true })
    expect(rbac.can('articles.edit')).toBe(true)
    expect(rbac.can('users.edit')).toBe(false)
  })

  it('lets superAdminRoles pass every permission check, except names in `denied`', () => {
    const rbac = createRbacChecker(
      { roles: ['super-admin'], permissions: [], denied: [' audit-log.delete'] },
      { superAdminRoles: ['super-admin'] },
    )
    expect(rbac.isSuperAdmin()).toBe(true)
    expect(rbac.can('flags.manage')).toBe(true)
    expect(rbac.can('audit-log.delete')).toBe(false)
    expect(rbac.cannot('audit-log.delete')).toBe(true)
    expect(rbac.canAny(['audit-log.delete', 'flags.manage'])).toBe(true)
    expect(rbac.canAll(['audit-log.delete', 'flags.manage'])).toBe(false)
    expect(rbac.snapshot.denied).toEqual(['audit-log.delete'])
  })

  it('lets `denied` win over stored grants and wildcards, for exact names only', () => {
    const rbac = createRbacChecker({ roles: [], permissions: ['audit-log.*'], denied: ['audit-log.delete'] }, { wildcard: true })
    expect(rbac.can('audit-log.delete')).toBe(false)
    expect(rbac.can('audit-log.delete.own')).toBe(true)
    expect(rbac.can('audit-log.view')).toBe(true)
  })

  it('keeps snapshots without `denied` as they are', () => {
    expect('denied' in createRbacChecker({ roles: ['x'], permissions: [] }).snapshot).toBe(false)
  })
})

describe('createRbacState', () => {
  it('follows a getter, and accepts a plain snapshot', () => {
    let current: { roles: string[]; permissions: string[] } | null = null
    const state = createRbacState(() => current, { superAdminRoles: ['admin'] })
    expect(state.isGuest).toBe(true)
    expect(state.can('a')).toBe(false)
    current = { roles: ['admin'], permissions: [] }
    // Outside a component nothing tracks `current`; a new state reads the new value.
    const next = createRbacState(() => current, { superAdminRoles: ['admin'] })
    expect(next.isGuest).toBe(false)
    expect(next.isSuperAdmin()).toBe(true)
    expect(next.can('a')).toBe(true)
    expect(next.cannot('a')).toBe(false)
    expect(next.canAny(['a'])).toBe(true)
    expect(next.canAll(['a', 'b'])).toBe(true)
    expect(next.hasRole('admin')).toBe(true)
    expect(next.hasAnyRole(['x', 'admin'])).toBe(true)
    expect(next.hasAllRoles(['x', 'admin'])).toBe(false)
    expect(next.snapshot.roles).toEqual(['admin'])

    expect(createRbacState({ roles: [], permissions: ['a'] }).can('a')).toBe(true)
  })
})
