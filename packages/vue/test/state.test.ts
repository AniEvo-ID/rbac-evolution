import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { createRbacState } from '../src'

describe('createRbacState', () => {
  const snapshot = { roles: ['writer'], permissions: ['edit articles', 'publish articles'] }

  it('checks permissions and roles', () => {
    const rbac = createRbacState({ snapshot })
    expect(rbac.can('edit articles')).toBe(true)
    expect(rbac.can('delete articles')).toBe(false)
    expect(rbac.cannot('delete articles')).toBe(true)
    expect(rbac.can(['edit articles', 'publish articles'])).toBe(true)
    expect(rbac.can(['edit articles', 'delete articles'])).toBe(false)
    expect(rbac.canAny(['delete articles', 'edit articles'])).toBe(true)
    expect(rbac.canAll(['delete articles', 'edit articles'])).toBe(false)
    expect(rbac.canAny([])).toBe(false)
    expect(rbac.canAll([])).toBe(false)

    expect(rbac.hasRole('writer')).toBe(true)
    expect(rbac.hasRole('admin|writer')).toBe(true)
    expect(rbac.hasRole(['admin', 'writer'])).toBe(true)
    expect(rbac.hasAllRoles(['admin', 'writer'])).toBe(false)
    expect(rbac.hasAllRoles('writer')).toBe(true)
  })

  it('defaults to a guest and updates reactively', () => {
    const rbac = createRbacState()
    const canEdit = computed(() => rbac.can('edit articles'))
    expect(canEdit.value).toBe(false)
    rbac.setSnapshot(snapshot)
    expect(canEdit.value).toBe(true)
    expect(rbac.snapshot.value.roles).toEqual(['writer'])
    rbac.setSnapshot(null)
    expect(canEdit.value).toBe(false)
  })

  it('does not match wildcards unless enabled', () => {
    const plain = createRbacState({ snapshot: { roles: [], permissions: ['articles.*'] } })
    expect(plain.can('articles.edit')).toBe(false)
    expect(plain.can('articles.*')).toBe(true)

    const wild = createRbacState({ snapshot: { roles: [], permissions: ['articles.*', 'users.view'] }, wildcard: true })
    expect(wild.can('articles.edit')).toBe(true)
    expect(wild.can('articles.edit.own')).toBe(true)
    expect(wild.can('users.view')).toBe(true)
    expect(wild.can('users.delete')).toBe(false)
    expect(wild.can('bad..permission')).toBe(false)
  })

  it('lets super-admin roles pass every permission check', () => {
    const rbac = createRbacState({ snapshot: { roles: ['super-admin'], permissions: [] }, superAdminRoles: ['super-admin'] })
    expect(rbac.isSuperAdmin()).toBe(true)
    expect(rbac.can('anything')).toBe(true)
    expect(rbac.canAny(['x', 'y'])).toBe(true)
    expect(rbac.hasRole('admin')).toBe(false)
  })
})

describe('loading', () => {
  it('denies every check, cannot included, until the first setSnapshot()', () => {
    const rbac = createRbacState({
      snapshot: { roles: ['admin'], permissions: ['x'] },
      superAdminRoles: ['admin'],
      loading: true,
    })
    expect(rbac.can('x')).toBe(false)
    expect(rbac.cannot('x')).toBe(false)
    expect(rbac.cannot('y')).toBe(false)
    expect(rbac.canAny('x')).toBe(false)
    expect(rbac.hasRole('admin')).toBe(false)
    expect(rbac.hasAllRoles('admin')).toBe(false)
    expect(rbac.isSuperAdmin()).toBe(false)

    rbac.setSnapshot(null)
    expect(rbac.cannot('x')).toBe(true)
  })
})
