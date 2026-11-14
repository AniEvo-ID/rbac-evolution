import { createRbacState } from '@anievo-id/rbac-evolution-vue'
import { describe, expect, it } from 'vitest'
import { evaluateRouteRule } from '../src/runtime/rule'

const writer = createRbacState({ snapshot: { roles: ['writer'], permissions: ['edit articles'] } })
const editor = createRbacState({
  snapshot: { roles: ['writer', 'editor'], permissions: ['edit articles', 'publish articles'] },
})

describe('evaluateRouteRule', () => {
  it('passes routes without requirements, even for guests', () => {
    expect(evaluateRouteRule(writer, {}, true)).toEqual({ ok: true })
    expect(evaluateRouteRule(writer, { redirect: '/x' }, false)).toEqual({ ok: true })
  })

  it('returns 401 for guests', () => {
    expect(evaluateRouteRule(writer, { permission: 'edit articles' }, true)).toEqual({
      ok: false,
      status: 401,
      error: 'UNAUTHENTICATED',
    })
  })

  it('requires every permission, pipes mean any, any: true', () => {
    expect(evaluateRouteRule(writer, { permission: 'edit articles' }, false).ok).toBe(true)
    expect(evaluateRouteRule(writer, { permission: ['edit articles', 'publish articles'] }, false)).toEqual({
      ok: false,
      status: 403,
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
    })
    expect(evaluateRouteRule(editor, { permission: ['edit articles', 'publish articles'] }, false).ok).toBe(true)
    expect(evaluateRouteRule(writer, { permission: 'publish articles|edit articles' }, false).ok).toBe(true)
    expect(evaluateRouteRule(writer, { permission: ['publish articles', 'edit articles'], any: true }, false).ok).toBe(
      true,
    )
  })

  it('checks roles (any by default, all: true)', () => {
    expect(evaluateRouteRule(writer, { role: 'admin|editor' }, false)).toMatchObject({ ok: false, reason: 'role' })
    expect(evaluateRouteRule(editor, { role: ['admin', 'editor'] }, false).ok).toBe(true)
    expect(evaluateRouteRule(writer, { role: ['writer', 'editor'], all: true }, false).ok).toBe(false)
    expect(evaluateRouteRule(editor, { role: ['writer', 'editor'], all: true }, false).ok).toBe(true)
  })

  it('checks role or permission', () => {
    expect(evaluateRouteRule(writer, { roleOrPermission: 'admin|publish articles' }, false)).toMatchObject({
      ok: false,
      reason: 'role_or_permission',
    })
    expect(evaluateRouteRule(editor, { roleOrPermission: 'admin|publish articles' }, false).ok).toBe(true)
    expect(evaluateRouteRule(writer, { roleOrPermission: 'writer' }, false).ok).toBe(true)
  })

  it('requires every key and denies empty names', () => {
    expect(evaluateRouteRule(editor, { permission: 'publish articles', role: 'admin' }, false)).toMatchObject({
      ok: false,
      reason: 'role',
    })
    expect(evaluateRouteRule(editor, { role: ' | ' }, false).ok).toBe(false)
    expect(evaluateRouteRule(editor, { permission: [] }, false).ok).toBe(false)
  })

  it('honours wildcard and super-admin settings of the Vue state', () => {
    const wild = createRbacState({ snapshot: { roles: [], permissions: ['articles.*'] }, wildcard: true })
    expect(evaluateRouteRule(wild, { permission: 'articles.edit' }, false).ok).toBe(true)
    const boss = createRbacState({ snapshot: { roles: ['boss'], permissions: [] }, superAdminRoles: ['boss'] })
    expect(evaluateRouteRule(boss, { permission: 'anything' }, false).ok).toBe(true)
  })
})
