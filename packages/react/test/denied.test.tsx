import { render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { RbacSnapshot } from '@anievo-id/rbac-evolution'
import { Can, Cannot, createRbacChecker, RbacProvider, useCan, useCanAll, useCanAny } from '../src'

const superAdmin: RbacSnapshot = { roles: ['super-admin'], permissions: [], denied: ['audit-log.delete'] }

describe('snapshot.denied (before hooks)', () => {
  it('denies the listed names even to a super-admin', () => {
    const rbac = createRbacChecker(superAdmin, { superAdminRoles: ['super-admin'] })
    expect(rbac.isSuperAdmin).toBe(true)
    expect(rbac.can('audit-log.delete')).toBe(false)
    expect(rbac.can(' audit-log.delete ')).toBe(false)
    expect(rbac.cannot('audit-log.delete')).toBe(true)
    expect(rbac.can('audit-log.view')).toBe(true)
    expect(rbac.canAny('audit-log.delete', 'audit-log.view')).toBe(true)
    expect(rbac.canAll('audit-log.delete', 'audit-log.view')).toBe(false)
  })

  it('wins over stored grants and wildcards, but matches exact names only', () => {
    const snapshot = { roles: [], permissions: ['audit-log.*', 'audit-log.delete'], denied: [' audit-log.delete '] }
    const rbac = createRbacChecker(snapshot, { wildcard: true })
    expect(rbac.can('audit-log.delete')).toBe(false)
    expect(rbac.can('audit-log.delete.own')).toBe(true) // the hook was asked about `audit-log.delete` only
    expect(rbac.can('audit-log.view')).toBe(true)
  })

  it('behaves as before for snapshots without `denied`', () => {
    const old = createRbacChecker({ roles: ['super-admin'], permissions: [] }, { superAdminRoles: ['super-admin'] })
    expect(old.can('audit-log.delete')).toBe(true)
    const empty = createRbacChecker({ roles: ['super-admin'], permissions: [], denied: [] }, { superAdminRoles: ['super-admin'] })
    expect(empty.can('audit-log.delete')).toBe(true)
  })

  it('still renders nothing while loading', () => {
    const rbac = createRbacChecker(superAdmin, { superAdminRoles: ['super-admin'], loading: true })
    expect(rbac.can('audit-log.delete')).toBe(false)
    expect(rbac.cannot('audit-log.delete')).toBe(false)
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <RbacProvider snapshot={superAdmin} superAdminRoles={['super-admin']}>
      {children}
    </RbacProvider>
  )

  it('reaches the hooks through <RbacProvider>', () => {
    expect(renderHook(() => useCan('audit-log.delete'), { wrapper }).result.current).toBe(false)
    expect(renderHook(() => useCan('flags.manage'), { wrapper }).result.current).toBe(true)
    expect(renderHook(() => useCanAny('audit-log.delete', 'flags.manage'), { wrapper }).result.current).toBe(true)
    expect(renderHook(() => useCanAll('audit-log.delete', 'flags.manage'), { wrapper }).result.current).toBe(false)
  })

  it('hides <Can> and shows <Cannot> for a denied name', () => {
    render(
      <RbacProvider snapshot={superAdmin} superAdminRoles={['super-admin']}>
        <Can permission="audit-log.delete" fallback={<span>no delete</span>}>
          <button>Delete audit log</button>
        </Can>
        <Can permission="flags.manage">
          <button>Flags</button>
        </Can>
        <Cannot permission="audit-log.delete">
          <span>locked</span>
        </Cannot>
      </RbacProvider>,
    )
    expect(screen.queryByText('Delete audit log')).toBeNull()
    expect(screen.getByText('no delete')).toBeTruthy()
    expect(screen.getByText('Flags')).toBeTruthy()
    expect(screen.getByText('locked')).toBeTruthy()
  })
})
