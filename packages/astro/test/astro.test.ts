import { createRbac, MemoryAdapter, type Rbac, type Subject } from '@anievo-id/rbac-evolution'
import type { APIContext, APIRoute, AstroGlobal, MiddlewareHandler } from 'astro'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { type AstroContext, createRbacServer } from '../src'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace App {
    interface Locals {
      user?: { id: number }
    }
  }
}

async function seed(rbac: Rbac): Promise<void> {
  for (const p of ['edit articles', 'delete articles', 'publish articles']) await rbac.createPermission(p)
  for (const r of ['writer', 'editor', 'admin', 'super-admin']) await rbac.createRole(r)
  await rbac.role('writer').givePermissionTo('edit articles')
  await rbac.role('editor').givePermissionTo('edit articles', 'publish articles')
  await rbac.for({ type: 'user', id: 1 }).assignRole('writer') // writer
  await rbac.for({ type: 'user', id: 2 }).assignRole('writer', 'editor') // writer + editor
  await rbac.for({ type: 'user', id: 3 }).assignRole('admin')
  await rbac.for({ type: 'user', id: 3 }).givePermissionTo('delete articles')
  await rbac.for({ type: 'user', id: 4 }).assignRole('super-admin')
}

// `locals.user` is what an auth middleware (Lucia, Better Auth, a session cookie...) sets.
const userFrom = ({ locals }: AstroContext): Subject | null => (locals.user ? { type: 'user', id: locals.user.id } : null)

const contextFor = (user?: number, path = '/', params: Record<string, string> = {}): AstroContext => {
  const url = new URL(`http://localhost${path}`)
  return {
    request: new Request(url),
    url,
    params,
    locals: user === undefined ? {} : { user: { id: user } },
    cookies: { get: () => undefined },
  }
}

const status = async (run: Promise<Response | undefined>) => (await run)?.status ?? 200

describe('createRbacServer', () => {
  const rbac = createRbac({ adapter: new MemoryAdapter(), superAdminRoles: ['super-admin'] })
  const server = createRbacServer({ rbac, getSubject: userFrom })
  beforeAll(() => seed(rbac))

  it('getRbac: the subject, or null for guests; resolved once per request', async () => {
    expect(await server.getRbac(contextFor())).toBeNull()
    const getSubject = vi.fn(userFrom)
    const counted = createRbacServer({ rbac, getSubject })
    const context = contextFor(2)
    const subject = await counted.getRbac(context)
    expect(subject?.subject).toEqual({ type: 'user', id: 2 })
    await counted.requirePermission(context, 'edit articles')
    await counted.getSnapshot(context)
    expect(getSubject).toHaveBeenCalledTimes(1)
  })

  it('getSnapshot: roles and permissions, null for guests, checkBefore and guard', async () => {
    expect(await server.getSnapshot(contextFor())).toBeNull()
    expect(await server.getSnapshot(contextFor(2))).toEqual({
      roles: ['writer', 'editor'],
      permissions: ['edit articles', 'publish articles'],
    })
    const denying = createRbacServer({
      rbac: createRbac({ adapter: rbac.adapter, before: ({ permission }) => (permission === 'publish articles' ? false : undefined) }),
      getSubject: userFrom,
    })
    expect((await denying.getSnapshot(contextFor(2), { checkBefore: ['publish articles'] }))?.denied).toEqual(['publish articles'])
    expect(await server.getSnapshot(contextFor(2), { guard: 'api' })).toEqual({ roles: [], permissions: [] })
  })

  it('resolves to a 401 JSON Response for guests', async () => {
    const response = await server.requirePermission(contextFor(), 'edit articles')
    expect(response).toBeInstanceOf(Response)
    expect(response?.status).toBe(401)
    expect(response?.headers.get('content-type')).toContain('application/json')
    expect(await response?.json()).toEqual({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' })
  })

  it('requirePermission: undefined when it passes; all-of args, pipe = any-of, any option', async () => {
    expect(await server.requirePermission(contextFor(1), 'edit articles')).toBeUndefined()
    expect(await status(server.requirePermission(contextFor(3), 'edit articles'))).toBe(403)
    expect(await status(server.requirePermission(contextFor(1), 'edit articles', 'publish articles'))).toBe(403)
    expect(await status(server.requirePermission(contextFor(2), ['edit articles', 'publish articles']))).toBe(200)
    expect(await status(server.requirePermission(contextFor(3), 'publish articles|delete articles'))).toBe(200)
    expect(await status(server.requirePermission(contextFor(3), 'publish articles', 'delete articles', { any: true }))).toBe(200)
    expect(await status(server.requirePermission(contextFor(1), 'publish articles', 'delete articles', { any: true }))).toBe(403)
    expect(await status(server.requirePermission(contextFor(4), 'fly'))).toBe(200) // super-admin
  })

  it('403 body without requirements by default, with them when exposed', async () => {
    const res = await server.requirePermission(contextFor(3), 'edit articles')
    expect(await res?.json()).toEqual({
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
    })
    const exposed = await server.requirePermission(contextFor(1), 'delete articles', { exposeRequirements: true })
    expect(await exposed?.json()).toMatchObject({ required: [['delete articles']] })
  })

  it('requireRole, requireRoleOrPermission, canAny, canAll', async () => {
    expect(await status(server.requireRole(contextFor(3), 'admin'))).toBe(200)
    expect(await status(server.requireRole(contextFor(2), 'admin|editor'))).toBe(200)
    expect(await status(server.requireRole(contextFor(1), 'admin', 'editor'))).toBe(403)
    expect(await status(server.requireRole(contextFor(2), 'writer', 'editor', { all: true }))).toBe(200)
    expect(await status(server.requireRole(contextFor(1), 'writer', 'editor', { all: true }))).toBe(403)
    expect(await status(server.requireRoleOrPermission(contextFor(3), 'admin|publish articles'))).toBe(200)
    expect(await status(server.requireRoleOrPermission(contextFor(2), 'admin|publish articles'))).toBe(200)
    const res = await server.requireRoleOrPermission(contextFor(1), 'admin|publish articles')
    expect(await res?.json()).toMatchObject({ reason: 'role_or_permission' })
    expect(await status(server.canAny(contextFor(1), 'publish articles', 'edit articles'))).toBe(200)
    expect(await status(server.canAll(contextFor(1), 'edit articles', 'publish articles'))).toBe(403)
    expect(await status(server.canAll(contextFor(2), 'edit articles', 'publish articles'))).toBe(200)
  })

  it('rejects guards without names', async () => {
    // @ts-expect-error -- no names is a type error; the runtime check stays for untyped callers
    await expect(server.requirePermission(contextFor(1))).rejects.toThrow(TypeError)
    // @ts-expect-error options without names is a type error
    await expect(server.requireRole(contextFor(1), { all: true })).rejects.toThrow(TypeError)
  })
})

describe('redirects and custom handlers', () => {
  const rbac = createRbac({ adapter: new MemoryAdapter() })
  beforeAll(() => seed(rbac))

  it('redirects with the server defaults, a guard option wins', async () => {
    const server = createRbacServer({
      rbac,
      getSubject: userFrom,
      unauthenticatedRedirect: ({ url }) => `/login?redirectTo=${url.pathname}`,
      forbiddenRedirect: '/denied',
    })
    const guest = await server.requireRole(contextFor(undefined, '/admin'), 'admin')
    expect(guest?.status).toBe(302)
    expect(guest?.headers.get('location')).toBe('/login?redirectTo=/admin')
    const denied = await server.requireRole(contextFor(1), 'admin')
    expect(denied?.headers.get('location')).toBe('/denied')
    const own = await server.requireRole(contextFor(1), 'admin', { forbiddenRedirect: '/upgrade' })
    expect(own?.headers.get('location')).toBe('/upgrade')
  })

  it('handlers return the Response; they win over redirects', async () => {
    const server = createRbacServer({
      rbac,
      getSubject: userFrom,
      unauthenticatedRedirect: '/login',
      onForbidden: (_context, { kind }) => new Response(`nope: ${kind}`, { status: 404 }),
    })
    const hidden = await server.requireRole(contextFor(1), 'admin')
    expect(hidden?.status).toBe(404)
    expect(await hidden?.text()).toBe('nope: role')
    const own = await server.requireRole(contextFor(), 'admin', { onUnauthenticated: async () => new Response(null, { status: 418 }) })
    expect(own?.status).toBe(418)
    // An option set to `undefined` keeps the server default.
    expect(await status(server.requireRole(contextFor(1), 'admin', { onForbidden: undefined }))).toBe(404)
  })
})

describe('teams and guards', () => {
  const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
  beforeAll(async () => {
    await rbac.createPermission('manage team')
    await rbac.createRole('owner', { team: 1 })
    await rbac.role('owner', { team: 1 }).givePermissionTo('manage team')
    await rbac.for({ type: 'user', id: 1 }, { team: 1 }).assignRole('owner')
    await rbac.createRole('admin', { guard: 'api', team: 1 })
    await rbac.for({ type: 'user', id: 10 }, { guard: 'api', team: 1 }).assignRole('admin')
  })

  it('scopes checks to the team of the route', async () => {
    const server = createRbacServer({ rbac, getSubject: userFrom, team: ({ params }) => Number(params.teamId) })
    expect(await status(server.requirePermission(contextFor(1, '/teams/1', { teamId: '1' }), 'manage team'))).toBe(200)
    expect(await status(server.requirePermission(contextFor(1, '/teams/2', { teamId: '2' }), 'manage team'))).toBe(403)
  })

  it('uses the server guard, or a guard per call', async () => {
    const api = createRbacServer({ rbac, getSubject: userFrom, guard: 'api', team: () => 1 })
    expect(await status(api.requireRole(contextFor(10), 'admin'))).toBe(200)
    const web = createRbacServer({ rbac, getSubject: userFrom, team: () => 1 })
    expect(await status(web.requireRole(contextFor(10), 'admin'))).toBe(403)
    expect(await status(web.requireRole(contextFor(10), 'admin', { guard: 'api' }))).toBe(200)
  })
})

describe('with Astro types', () => {
  const rbac = createRbac({ adapter: new MemoryAdapter() })
  const server = createRbacServer({ rbac, getSubject: userFrom })
  beforeAll(() => seed(rbac))

  // Astro's own contexts are accepted as they are: an endpoint, a middleware and a page's `Astro`.
  const GET: APIRoute = async (context) => (await server.requireRole(context, 'admin')) ?? Response.json({ ok: true })
  const onRequest: MiddlewareHandler = async (context, next) => {
    if (context.url.pathname.startsWith('/admin')) {
      const denied = await server.requireRole(context, 'admin')
      if (denied) return denied
    }
    return next()
  }
  const page = async (Astro: AstroGlobal) => (await server.requirePermission(Astro, 'edit articles')) ?? new Response('page')

  const astro = (user?: number, path = '/') => contextFor(user, path) as unknown as APIContext & AstroGlobal

  it('an endpoint returns the guard Response or its own', async () => {
    expect((await GET(astro(1))).status).toBe(403)
    expect(await (await GET(astro(3))).json()).toEqual({ ok: true })
  })

  it('a middleware protects a path and calls next() otherwise', async () => {
    const next = vi.fn(async () => new Response('next'))
    expect(((await onRequest(astro(undefined, '/admin/users'), next)) as Response).status).toBe(401)
    expect(await ((await onRequest(astro(3, '/admin/users'), next)) as Response).text()).toBe('next')
    expect(await ((await onRequest(astro(undefined, '/blog'), next)) as Response).text()).toBe('next')
  })

  it('a page returns the guard Response', async () => {
    expect((await page(astro())).status).toBe(401)
    expect(await (await page(astro(1))).text()).toBe('page')
  })
})

describe('typed engine', () => {
  type AppRbac = {
    permissions: 'edit articles' | 'delete articles' | 'publish articles'
    roles: 'writer' | 'editor' | 'admin' | 'super-admin'
  }
  const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
  const server = createRbacServer({ rbac, getSubject: userFrom })
  beforeAll(() => seed(rbac as unknown as Rbac))

  it('checks names at compile time and returns a typed subject', async () => {
    expect(await server.requirePermission(contextFor(2), 'edit articles')).toBeUndefined()
    expect(await (await server.getRbac(contextFor(2)))?.can('publish articles')).toBe(true)
    // @ts-expect-error a typo in a permission name is a type error
    expect(await status(server.requirePermission(contextFor(2), 'edit artcles'))).toBe(403)
    // @ts-expect-error a role name is not a permission
    expect(await status(server.requirePermission(contextFor(2), 'admin'))).toBe(403)
  })
})
