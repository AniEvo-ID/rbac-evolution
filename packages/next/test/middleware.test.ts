import { describe, expect, it } from 'vitest'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import type { RbacSnapshot, Subject } from '@anievo-id/rbac-evolution'
import { compilePathPattern, createRbacMiddleware, matchPath } from '../src/middleware-entry'

describe('matchPath', () => {
  it.each([
    ['/admin', '/admin', true],
    ['/admin', '/admin/', true],
    ['/admin', '/admin/users', false],
    ['/admin', '/administrator', false],
    ['/admin/:path*', '/admin', true],
    ['/admin/:path*', '/admin/users/1', true],
    ['/admin/:path*', '/administrator', false],
    ['/admin/:path+', '/admin', false],
    ['/admin/:path+', '/admin/a/b', true],
    ['/users/:id', '/users/1', true],
    ['/users/:id', '/users', false],
    ['/users/:id', '/users/1/edit', false],
    ['/users/:id/edit', '/users/1/edit', true],
    ['/blog/:slug?', '/blog', true],
    ['/blog/:slug?', '/blog/x', true],
    ['/blog/:slug?', '/blog/x/y', false],
    ['/', '/', true],
    ['/', '/x', false],
    ['/a.b', '/aXb', false],
  ])('%s vs %s → %s', (pattern, path, expected) => {
    expect(matchPath(pattern, path)).toBe(expected)
  })

  it('supports RegExp and arrays', () => {
    expect(matchPath(/^\/api\//, '/api/x')).toBe(true)
    expect(matchPath(['/a', '/b/:path*'], '/b/c')).toBe(true)
    expect(matchPath(['/a', '/b/:path*'], '/c')).toBe(false)
  })

  it('caches compiled patterns', () => {
    expect(compilePathPattern('/x/:id')).toBe(compilePathPattern('/x/:id'))
  })
})

const req = (path: string) => new Request(`http://localhost${path}`)

describe('createRbacMiddleware (snapshot loader)', () => {
  const sessions: Record<string, RbacSnapshot> = {
    writer: { roles: ['writer'], permissions: ['articles.edit', 'posts.*'] },
    admin: { roles: ['admin'], permissions: [] },
  }
  const who = (r: Request) => new URL(r.url).searchParams.get('as')
  const middleware = createRbacMiddleware({
    rules: [
      { matcher: '/admin/:path*', role: 'admin' },
      { matcher: '/articles/:id/edit', permission: 'articles.edit' },
      { matcher: '/posts/:path*', permission: 'posts.delete' },
      { matcher: '/dashboard/:path*' },
    ],
    getSnapshot: (r) => sessions[who(r) ?? ''] ?? null,
    wildcard: true,
    superAdminRoles: ['admin'],
  })

  it('lets unmatched requests through', async () => {
    expect(await middleware(req('/'))).toBeUndefined()
  })

  it('401 for guests on protected paths', async () => {
    const res = await middleware(req('/dashboard'))
    expect(res?.status).toBe(401)
    expect(await res?.json()).toEqual({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' })
  })

  it('403 when missing role/permission, through when allowed', async () => {
    expect((await middleware(req('/admin/users?as=writer')))?.status).toBe(403)
    expect(await middleware(req('/admin/users?as=admin'))).toBeUndefined()
    expect(await middleware(req('/articles/1/edit?as=writer'))).toBeUndefined()
    expect(await middleware(req('/dashboard?as=writer'))).toBeUndefined()
  })

  it('wildcard and super admin', async () => {
    expect(await middleware(req('/posts/1?as=writer'))).toBeUndefined()
    expect(await middleware(req('/articles/1/edit?as=admin'))).toBeUndefined()
  })

  it('prefers nextUrl.pathname (basePath-stripped)', async () => {
    const r = Object.assign(req('/base/admin?as=writer'), { nextUrl: { pathname: '/admin' } })
    expect((await middleware(r))?.status).toBe(403)
  })

  it('redirects guests to loginUrl and supports custom responses', async () => {
    const mw = createRbacMiddleware({
      rules: [{ matcher: '/admin/:path*', role: 'admin' }],
      getSnapshot: (r) => sessions[who(r) ?? ''] ?? null,
      loginUrl: (r) => `/login?callbackUrl=${encodeURIComponent(new URL(r.url).pathname)}`,
      onUnauthorized: () => new Response('nope', { status: 404 }),
    })
    const res = await mw(req('/admin/x'))
    expect(res?.status).toBe(307)
    expect(res?.headers.get('location')).toBe('http://localhost/login?callbackUrl=%2Fadmin%2Fx')
    expect((await mw(req('/admin/x?as=writer')))?.status).toBe(404)
  })

  it('every matching rule must pass', async () => {
    const mw = createRbacMiddleware({
      rules: [
        { matcher: '/admin/:path*', role: 'writer' },
        { matcher: '/admin/billing', permission: 'billing.view' },
      ],
      getSnapshot: (r) => sessions[who(r) ?? ''] ?? null,
    })
    expect(await mw(req('/admin/x?as=writer'))).toBeUndefined()
    expect((await mw(req('/admin/billing?as=writer')))?.status).toBe(403)
  })

  it('does not load the snapshot for unmatched paths', async () => {
    let calls = 0
    const mw = createRbacMiddleware({
      rules: [{ matcher: '/admin' }],
      getSnapshot: () => {
        calls++
        return null
      },
    })
    await mw(req('/public'))
    expect(calls).toBe(0)
  })
})

describe('createRbacMiddleware (rbac instance)', () => {
  it('loads the snapshot through rbac.for(subject)', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await rbac.createPermission('reports.view')
    await rbac.createRole('manager')
    await rbac.role('manager').givePermissionTo('reports.view')
    const manager: Subject = { type: 'user', id: 1 }
    await rbac.for(manager).assignRole('manager')

    const mw = createRbacMiddleware({
      rbac,
      getSubject: (r) => (r.headers.get('x-user') === '1' ? manager : r.headers.get('x-user') ? { type: 'user', id: 2 } : null),
      rules: [
        { matcher: '/reports/:path*', permission: 'reports.view' },
        { matcher: '/team/:path*', roleOrPermission: ['manager', 'team.view'] },
      ],
    })
    const withUser = (path: string, id?: string) =>
      new Request(`http://localhost${path}`, id ? { headers: { 'x-user': id } } : {})

    expect((await mw(withUser('/reports')))?.status).toBe(401)
    expect((await mw(withUser('/reports', '2')))?.status).toBe(403)
    expect(await mw(withUser('/reports/q1', '1'))).toBeUndefined()
    expect(await mw(withUser('/team', '1'))).toBeUndefined()
  })

  it('applies superAdminRoles and the before hook like the server helpers', async () => {
    const rbac = createRbac({
      adapter: new MemoryAdapter(),
      superAdminRoles: ['super-admin'],
      before: ({ permission }) => (permission === 'danger.zone' ? false : undefined),
    })
    await rbac.createPermission('reports.view')
    await rbac.createPermission('danger.zone')
    await rbac.createRole('super-admin')
    const root: Subject = { type: 'user', id: 1 }
    await rbac.for(root).assignRole('super-admin')

    const mw = createRbacMiddleware({
      rbac,
      getSubject: () => root,
      rules: [
        { matcher: '/reports/:path*', permission: 'reports.view' },
        { matcher: '/danger', permission: 'danger.zone' },
      ],
    })

    expect(await mw(new Request('http://localhost/reports/q1'))).toBeUndefined()
    const denied = await mw(new Request('http://localhost/danger'))
    expect(denied?.status).toBe(403)
    expect(await denied?.json()).toEqual({
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
    })
  })
})

describe('typing with NextRequest', () => {
  it('accepts NextRequest-typed callbacks', async () => {
    const { NextRequest } = await import('next/server')
    const mw = createRbacMiddleware<InstanceType<typeof NextRequest>>({
      rules: [{ matcher: '/admin/:path*', role: 'admin' }],
      getSnapshot: (req) => (req.cookies.get('role')?.value === 'admin' ? { roles: ['admin'], permissions: [] } : null),
      loginUrl: (req) => `/login?callbackUrl=${encodeURIComponent(req.nextUrl.pathname)}`,
    })
    const res = await mw(new NextRequest('http://localhost/admin/x'))
    expect(res?.headers.get('location')).toBe('http://localhost/login?callbackUrl=%2Fadmin%2Fx')
    const ok = await mw(new NextRequest('http://localhost/admin/x', { headers: { cookie: 'role=admin' } }))
    expect(ok).toBeUndefined()
  })
})
