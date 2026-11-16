import { render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { RbacSnapshot } from '@anievo-id/rbac-evolution'
import {
  Can,
  Cannot,
  HasRole,
  UnlessRole,
  RbacProvider,
  useCan,
  useCanAll,
  useCanAny,
  useHasAllRoles,
  useHasAnyRole,
  useHasRole,
  useRbac,
} from '../src'

const snapshot: RbacSnapshot = { roles: ['writer'], permissions: ['articles.edit', 'articles.view', 'posts.*'] }

function wrap(props: { snapshot?: RbacSnapshot | null; wildcard?: boolean; superAdminRoles?: string[] } = {}) {
  return ({ children }: { children: ReactNode }) => (
    <RbacProvider
      snapshot={props.snapshot === undefined ? snapshot : props.snapshot}
      wildcard={props.wildcard ?? false}
      {...(props.superAdminRoles ? { superAdminRoles: props.superAdminRoles } : {})}
    >
      {children}
    </RbacProvider>
  )
}

describe('hooks', () => {
  it('useCan / useCanAny / useCanAll', () => {
    const { result } = renderHook(
      () => ({
        edit: useCan('articles.edit'),
        del: useCan('articles.delete'),
        any: useCanAny('articles.delete', 'articles.view'),
        all: useCanAll(['articles.edit', 'articles.delete']),
      }),
      { wrapper: wrap() },
    )
    expect(result.current).toEqual({ edit: true, del: false, any: true, all: false })
  })

  it('role hooks', () => {
    const { result } = renderHook(
      () => ({
        writer: useHasRole('writer'),
        either: useHasRole(['admin', 'writer']),
        any: useHasAnyRole('admin'),
        all: useHasAllRoles('writer'),
      }),
      { wrapper: wrap() },
    )
    expect(result.current).toEqual({ writer: true, either: true, any: false, all: true })
  })

  it('wildcard matching when enabled', () => {
    const off = renderHook(() => useCan('posts.delete'), { wrapper: wrap() })
    expect(off.result.current).toBe(false)
    const on = renderHook(() => useCan('posts.delete'), { wrapper: wrap({ wildcard: true }) })
    expect(on.result.current).toBe(true)
  })

  it('superAdminRoles makes can() true', () => {
    const { result } = renderHook(() => useCan('users.delete'), {
      wrapper: wrap({ snapshot: { roles: ['super-admin'], permissions: [] }, superAdminRoles: ['super-admin'] }),
    })
    expect(result.current).toBe(true)
  })

  it('useRbac throws outside a provider', () => {
    expect(() => renderHook(() => useRbac())).toThrow(/RbacProvider/)
  })
})

describe('components', () => {
  it('<Can> renders children or fallback', () => {
    render(
      <RbacProvider snapshot={snapshot}>
        <Can permission="articles.edit"><span>edit-yes</span></Can>
        <Can permission="articles.delete" fallback={<span>delete-no</span>}>
          delete-yes
        </Can>
        <Can anyOf={['articles.delete', 'articles.view']}><span>any-yes</span></Can>
        <Can allOf={['articles.edit', 'articles.delete']} fallback={<span>all-no</span>}><span>all-yes</span></Can>
      </RbacProvider>,
    )
    expect(screen.queryByText('edit-yes')).not.toBeNull()
    expect(screen.queryByText('delete-yes')).toBeNull()
    expect(screen.queryByText('delete-no')).not.toBeNull()
    expect(screen.queryByText('any-yes')).not.toBeNull()
    expect(screen.queryByText('all-yes')).toBeNull()
    expect(screen.queryByText('all-no')).not.toBeNull()
  })

  it('<Cannot> is the inverse of <Can>', () => {
    render(
      <RbacProvider snapshot={snapshot}>
        <Cannot permission="articles.delete"><span>cannot-delete</span></Cannot>
        <Cannot permission="articles.edit" fallback={<span>can-edit</span>}><span>cannot-edit</span></Cannot>
      </RbacProvider>,
    )
    expect(screen.queryByText('cannot-delete')).not.toBeNull()
    expect(screen.queryByText('cannot-edit')).toBeNull()
    expect(screen.queryByText('can-edit')).not.toBeNull()
  })

  it('<HasRole> supports role / anyOf / allOf', () => {
    render(
      <RbacProvider snapshot={snapshot}>
        <HasRole role="writer"><span>is-writer</span></HasRole>
        <HasRole role="admin" fallback={<span>not-admin</span>}><span>is-admin</span></HasRole>
        <HasRole anyOf={['admin', 'writer']}><span>any-role</span></HasRole>
        <HasRole allOf={['admin', 'writer']}><span>all-roles</span></HasRole>
      </RbacProvider>,
    )
    expect(screen.queryByText('is-writer')).not.toBeNull()
    expect(screen.queryByText('is-admin')).toBeNull()
    expect(screen.queryByText('not-admin')).not.toBeNull()
    expect(screen.queryByText('any-role')).not.toBeNull()
    expect(screen.queryByText('all-roles')).toBeNull()
  })

  it('<UnlessRole> renders when the user lacks the role(s), like @unlessrole', () => {
    const Untyped = UnlessRole as unknown as (p: { children: ReactNode }) => ReactNode
    render(
      <RbacProvider snapshot={snapshot}>
        <UnlessRole role="banned"><span>not-banned</span></UnlessRole>
        <UnlessRole role="writer" fallback={<span>writer-fallback</span>}><span>not-writer</span></UnlessRole>
        <UnlessRole anyOf={['admin', 'banned']}><span>none-of</span></UnlessRole>
        <UnlessRole allOf={['admin', 'writer']}><span>not-all</span></UnlessRole>
        <Untyped>no-condition</Untyped>
      </RbacProvider>,
    )
    expect(screen.queryByText('not-banned')).not.toBeNull()
    expect(screen.queryByText('not-writer')).toBeNull()
    expect(screen.queryByText('writer-fallback')).not.toBeNull()
    expect(screen.queryByText('none-of')).not.toBeNull()
    expect(screen.queryByText('not-all')).not.toBeNull()
    expect(screen.queryByText('no-condition')).toBeNull()
  })

  it('denies when no condition is given (untyped usage)', () => {
    const Untyped = Can as unknown as (p: { children: ReactNode }) => ReactNode
    render(
      <RbacProvider snapshot={snapshot}>
        <Untyped>never</Untyped>
      </RbacProvider>,
    )
    expect(screen.queryByText('never')).toBeNull()
  })

  it('re-renders when the snapshot prop changes', () => {
    const ui = (snap: RbacSnapshot) => (
      <RbacProvider snapshot={snap}>
        <Can permission="articles.delete" fallback={<span>no</span>}><span>yes</span></Can>
      </RbacProvider>
    )
    const { rerender } = render(ui(snapshot))
    expect(screen.queryByText('no')).not.toBeNull()
    rerender(ui({ roles: [], permissions: ['articles.delete'] }))
    expect(screen.queryByText('yes')).not.toBeNull()
  })

  it('treats a null snapshot as a guest', () => {
    render(
      <RbacProvider snapshot={null}>
        <Can permission="articles.edit" fallback={<span>guest</span>}><span>member</span></Can>
      </RbacProvider>,
    )
    expect(screen.queryByText('guest')).not.toBeNull()
  })
})

describe('loading state', () => {
  const gates = (loading: boolean) => (
    <RbacProvider snapshot={null} loading={loading}>
      <Cannot permission="articles.edit"><span>read-only</span></Cannot>
      <Can permission="articles.edit" fallback={<span>no-edit</span>}>edit</Can>
      <HasRole role="admin" fallback={<span>not-admin</span>}>admin</HasRole>
    </RbacProvider>
  )

  it('renders nothing (not even the fallback) while loading, then the normal result', () => {
    const { rerender } = render(gates(true))
    for (const text of ['read-only', 'no-edit', 'not-admin']) expect(screen.queryByText(text)).toBeNull()

    rerender(gates(false))
    for (const text of ['read-only', 'no-edit', 'not-admin']) expect(screen.queryByText(text)).not.toBeNull()
  })

  it('exposes loading on the checker; checks still deny', () => {
    const { result } = renderHook(() => useRbac(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <RbacProvider snapshot={null} loading>
          {children}
        </RbacProvider>
      ),
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.can('articles.edit')).toBe(false)
  })
})
