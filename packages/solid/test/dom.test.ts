import type { RbacSnapshot } from '@anievo-id/rbac-evolution'
import * as solid from 'solid-js'
import { createComponent, createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import {
  Can,
  Cannot,
  HasRole,
  RbacProvider,
  type RbacProviderProps,
  UnlessRole,
  useCan,
  useCanAll,
  useCanAny,
  useCannot,
  useHasAllRoles,
  useHasAnyRole,
  useHasRole,
  useRbac,
  type SolidElement,
} from '../src'
import { loadWeb } from './web'

const { render } = await loadWeb()

const writer: RbacSnapshot = { roles: ['writer'], permissions: ['articles.edit', 'articles.view'] }

let dispose: (() => void) | undefined
afterEach(() => {
  dispose?.()
  dispose = undefined
  document.body.innerHTML = ''
})

/** Solid 2 applies updates on `flush()`; Solid 1 applies them at once. */
const settle = (): void => (solid as unknown as { flush?: () => void }).flush?.()

/** Mounts `view` inside an `RbacProvider` and returns the container. */
function mount(provider: Omit<RbacProviderProps, 'children'>, view: () => SolidElement): HTMLElement {
  const root = document.createElement('div')
  document.body.append(root)
  dispose = render(
    () =>
      createComponent(RbacProvider, {
        get snapshot() {
          return provider.snapshot
        },
        get wildcard() {
          return provider.wildcard
        },
        get superAdminRoles() {
          return provider.superAdminRoles
        },
        get loading() {
          return provider.loading
        },
        get children() {
          return view()
        },
      }),
    root,
  )
  settle()
  return root
}

const text = (value: string): SolidElement => {
  const span = document.createElement('span')
  span.textContent = value
  return span
}

describe('components', () => {
  it('<Can> renders children or fallback', () => {
    const root = mount({ snapshot: writer }, () => [
      createComponent(Can, { permission: 'articles.edit', children: text('edit') }),
      createComponent(Can, { permission: 'articles.delete', fallback: text('no-delete'), children: text('delete') }),
      createComponent(Can, { anyOf: ['x', 'articles.view'], children: text('any') }),
      createComponent(Can, { allOf: ['articles.view', 'x'], fallback: text('not-all'), children: text('all') }),
    ])
    expect(root.textContent).toBe('editno-deleteanynot-all')
  })

  it('<Cannot>, <HasRole> and <UnlessRole>', () => {
    const root = mount({ snapshot: writer }, () => [
      createComponent(Cannot, { permission: 'articles.delete', children: text('cannot-delete') }),
      createComponent(Cannot, { permission: 'articles.edit', fallback: text('can-edit'), children: text('x') }),
      createComponent(HasRole, { role: 'writer', children: text('writer') }),
      createComponent(HasRole, { allOf: ['writer', 'admin'], fallback: text('not-both'), children: text('x') }),
      createComponent(HasRole, { anyOf: ['admin', 'writer'], children: text('any-role') }),
      createComponent(UnlessRole, { role: 'admin', children: text('not-admin') }),
      createComponent(UnlessRole, { anyOf: ['writer'], fallback: text('is-writer'), children: text('x') }),
      createComponent(UnlessRole, { allOf: ['writer', 'admin'], children: text('not-all-roles') }),
    ])
    expect(root.textContent).toBe('cannot-deletecan-editwriternot-bothany-rolenot-adminis-writernot-all-roles')
  })

  it('denies a component without a condition (untyped callers)', () => {
    const loose = (component: unknown) =>
      createComponent(component as (p: object) => SolidElement, { fallback: text('denied'), children: text('x') })
    const root = mount({ snapshot: writer }, () => [loose(Can), loose(Cannot), loose(HasRole), loose(UnlessRole)])
    expect(root.textContent).toBe('denieddenieddenieddenied')
  })

  it('renders nothing while loading, not even the fallback', () => {
    const root = mount({ snapshot: null, loading: true }, () => [
      createComponent(Can, { permission: 'a', fallback: text('fallback'), children: text('x') }),
      createComponent(Cannot, { permission: 'a', children: text('x') }),
      createComponent(HasRole, { role: 'a', fallback: text('fallback'), children: text('x') }),
    ])
    expect(root.textContent).toBe('')
  })

  it('treats a guest (null snapshot) as having nothing', () => {
    const root = mount({ snapshot: null }, () =>
      createComponent(Can, { permission: 'articles.view', fallback: text('guest'), children: text('x') }),
    )
    expect(root.textContent).toBe('guest')
  })

  it('applies wildcard and superAdminRoles', () => {
    const root = mount({ snapshot: { roles: [], permissions: ['articles.*'] }, wildcard: true }, () =>
      createComponent(Can, { permission: 'articles.delete', children: text('wildcard') }),
    )
    expect(root.textContent).toBe('wildcard')
    dispose?.()
    const admin = mount({ snapshot: { roles: ['admin'], permissions: [] }, superAdminRoles: ['admin'] }, () =>
      createComponent(Can, { permission: 'anything', children: text('super') }),
    )
    expect(admin.textContent).toBe('super')
  })
})

describe('reactivity', () => {
  it('updates when the snapshot signal changes, and keeps the children while the result is unchanged', () => {
    const [snapshot, setSnapshot] = createSignal<RbacSnapshot | null>(null)
    const [loading, setLoading] = createSignal(true)
    let created = 0
    const root = document.createElement('div')
    document.body.append(root)
    dispose = render(
      () =>
        createComponent(RbacProvider, {
          get snapshot() {
            return snapshot()
          },
          get loading() {
            return loading()
          },
          get children() {
            return createComponent(Can, {
              permission: 'articles.edit',
              fallback: text('no'),
              get children() {
                created++
                return text('yes')
              },
            })
          },
        }),
      root,
    )
    settle()
    expect(root.textContent).toBe('')

    setSnapshot(writer)
    setLoading(false)
    settle()
    expect(root.textContent).toBe('yes')
    expect(created).toBe(1)

    // Another snapshot with the same result: the branch is not rebuilt.
    setSnapshot({ roles: [], permissions: ['articles.edit'] })
    settle()
    expect(root.textContent).toBe('yes')
    expect(created).toBe(1)

    setSnapshot({ roles: [], permissions: [] })
    settle()
    expect(root.textContent).toBe('no')
  })
})

describe('hooks', () => {
  it('return accessors that follow the snapshot', () => {
    const [snapshot, setSnapshot] = createSignal<RbacSnapshot | null>(writer)
    const seen: Record<string, () => boolean> = {}
    const root = document.createElement('div')
    document.body.append(root)
    dispose = render(
      () =>
        createComponent(RbacProvider, {
          get snapshot() {
            return snapshot()
          },
          get children() {
            seen.can = useCan('articles.edit')
            seen.cannot = useCannot('articles.delete')
            seen.canAny = useCanAny('x', ['articles.view'])
            seen.canAll = useCanAll(['articles.view', 'articles.edit'])
            seen.hasRole = useHasRole(['admin', 'writer'])
            seen.hasAnyRole = useHasAnyRole('admin', 'writer')
            seen.hasAllRoles = useHasAllRoles('admin', 'writer')
            const rbac = useRbac()
            seen.roles = () => rbac().roles.includes('writer')
            return null
          },
        }),
      root,
    )
    settle()
    const values = () => Object.fromEntries(Object.entries(seen).map(([k, f]) => [k, f()]))
    expect(values()).toEqual({
      can: true,
      cannot: true,
      canAny: true,
      canAll: true,
      hasRole: true,
      hasAnyRole: true,
      hasAllRoles: false,
      roles: true,
    })
    setSnapshot(null)
    settle()
    expect(values()).toEqual({
      can: false,
      cannot: true,
      canAny: false,
      canAll: false,
      hasRole: false,
      hasAnyRole: false,
      hasAllRoles: false,
      roles: false,
    })
  })

  it('useRbac() throws outside a provider', () => {
    const root = document.createElement('div')
    expect(() => {
      dispose = render(() => {
        useCan('x')
        return null
      }, root)
    }).toThrow('useRbac() must be used inside <RbacProvider>.')
  })
})
