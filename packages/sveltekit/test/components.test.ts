import { render, screen } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, expect, it } from 'vitest'
import { Can, createRbacState, RBAC_KEY } from '../src/index.js'
import Layout from './fixtures/Layout.svelte'
import Page from './fixtures/Page.svelte'

const shown = (id: string): boolean => screen.queryByTestId(id) !== null

const writer = { roles: ['writer'], permissions: ['articles.edit'] }
const editor = { roles: ['writer', 'editor'], permissions: ['articles.edit', 'articles.publish'] }

describe('setRbacContext + <Can> / <HasRole>', () => {
  it('renders children or the fallback snippet from the snapshot', () => {
    render(Layout, { props: { data: { rbac: writer } } })
    expect(screen.getByTestId('status').textContent).toBe('user')
    expect(screen.getByTestId('can-publish').textContent).toBe('false')
    expect(shown('edit')).toBe(true)
    expect(shown('edit-fallback')).toBe(false)
    expect(shown('any')).toBe(false)
    expect(shown('all')).toBe(false)
    expect(shown('not-edit')).toBe(false)
    expect(shown('no-condition')).toBe(false)
    expect(shown('staff')).toBe(true)
    expect(shown('both')).toBe(false)
    expect(shown('both-fallback')).toBe(true)
    expect(shown('admin')).toBe(false)
    expect(shown('not-admin')).toBe(true)
    expect(shown('no-role-condition')).toBe(false)
  })

  it('follows the layout data (e.g. after invalidateAll() on login / logout)', async () => {
    const { rerender } = render(Layout, { props: { data: { rbac: null } } })
    expect(screen.getByTestId('status').textContent).toBe('guest')
    expect(shown('edit-fallback')).toBe(true)
    expect(shown('not-edit')).toBe(true)

    await rerender({ data: { rbac: editor } })
    expect(screen.getByTestId('status').textContent).toBe('user')
    expect(screen.getByTestId('can-publish').textContent).toBe('true')
    expect(shown('edit')).toBe(true)
    expect(shown('any')).toBe(true)
    expect(shown('all')).toBe(true)
    expect(shown('both')).toBe(true)

    await rerender({ data: { rbac: null } })
    expect(screen.getByTestId('status').textContent).toBe('guest')
    expect(shown('edit')).toBe(false)
    expect(shown('staff')).toBe(false)
  })

  it('lets super-admins and wildcards through, but not past `denied`', () => {
    render(Layout, { props: { data: { rbac: { roles: ['super-admin'], permissions: [], denied: ['billing.manage'] } } } })
    expect(shown('all')).toBe(true)
    expect(shown('billing')).toBe(false)
    expect(shown('admin')).toBe(false) // super-admin passes permission checks, not role checks
  })

  it('matches wildcard grants (the layout sets wildcard: true)', () => {
    render(Layout, { props: { data: { rbac: { roles: [], permissions: ['articles.*'] } } } })
    expect(shown('all')).toBe(true)
    expect(screen.getByTestId('can-publish').textContent).toBe('true')
  })

  it('throws a helpful error without setRbacContext()', () => {
    expect(() => render(Page)).toThrow(/setRbacContext/)
  })

  it('works with createRbacState() in a test context map', () => {
    render(Page, { context: new Map([[RBAC_KEY, createRbacState(editor)]]) })
    expect(shown('all')).toBe(true)
  })

  it('can be rendered on its own (no children, no fallback)', () => {
    const { container } = render(Can, { props: { permission: 'articles.edit' }, context: new Map([[RBAC_KEY, createRbacState(writer)]]) })
    flushSync()
    expect(container.textContent?.trim()).toBe('')
  })
})
