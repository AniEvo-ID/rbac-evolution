import { createComponent } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { Can, Cannot, HasRole, RbacProvider, UnlessRole, useCan } from '../src'
import { loadWeb } from './web'

const { renderToString } = await loadWeb()

describe('server rendering', () => {
  it('renders the allowed branches into the HTML', () => {
    let canEdit: boolean | undefined
    const html = renderToString(() =>
      createComponent(RbacProvider, {
        snapshot: { roles: ['writer'], permissions: ['articles.edit'] },
        get children() {
          canEdit = useCan('articles.edit')()
          return [
            createComponent(Can, { permission: 'articles.edit', children: 'edit;' }),
            createComponent(Can, { permission: 'articles.delete', fallback: 'no-delete;', children: 'delete;' }),
            createComponent(Cannot, { permission: 'articles.delete', children: 'cannot-delete;' }),
            createComponent(HasRole, { role: 'writer', children: 'writer;' }),
            createComponent(UnlessRole, { role: 'admin', children: 'not-admin;' }),
          ]
        },
      }),
    )
    expect(html.replace(/<!--[^>]*-->/g, '')).toBe('edit;no-delete;cannot-delete;writer;not-admin;')
    expect(canEdit).toBe(true)
  })

  it('renders nothing for gated UI while loading', () => {
    const html = renderToString(() =>
      createComponent(RbacProvider, {
        snapshot: null,
        loading: true,
        get children() {
          return createComponent(Can, { permission: 'a', fallback: 'fallback', children: 'x' })
        },
      }),
    )
    expect(html.replace(/<!--[^>]*-->/g, '')).toBe('')
  })
})
