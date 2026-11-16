import { createRbac, MemoryAdapter, type Rbac } from '@anievo-id/rbac-evolution'
import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  createGuards,
  type RbacEnv,
  rbacMiddleware,
  RbacMiddlewareMissingError,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  canAny,
  canAll,
} from '../src'

const ok = (c: Context) => c.json({ ok: true })

const userFrom = (c: Context) => {
  const id = c.req.header('x-user')
  return id ? { type: 'user', id: Number(id) } : null
}

async function seed(rbac: Rbac): Promise<void> {
  for (const p of ['edit articles', 'delete articles', 'publish articles']) await rbac.createPermission(p)
  await rbac.createRole('writer')
  await rbac.createRole('editor')
  await rbac.createRole('admin')
  await rbac.createRole('super-admin')
  await rbac.role('writer').givePermissionTo('edit articles')
  await rbac.role('editor').givePermissionTo('edit articles', 'publish articles')
  await rbac.for({ type: 'user', id: 1 }).assignRole('writer') // writer
  await rbac.for({ type: 'user', id: 2 }).assignRole('writer', 'editor') // writer + editor
  await rbac.for({ type: 'user', id: 3 }).assignRole('admin')
  await rbac.for({ type: 'user', id: 3 }).givePermissionTo('delete articles')
  await rbac.for({ type: 'user', id: 4 }).assignRole('super-admin')
}

const onError = (err: Error, c: Context) => {
  if (err instanceof HTTPException) return err.getResponse()
  return c.json({ error: (err as Error & { code?: string }).code ?? 'ERROR', message: err.message }, 500)
}

describe('rbac-evolution-hono', () => {
  const app = new Hono<RbacEnv>()
  const seenRbac: unknown[] = []

  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), superAdminRoles: ['super-admin'] })
    await seed(rbac)

    app.use(rbacMiddleware({ rbac, getSubject: async (c) => userFrom(c) }))

    app.get('/me', async (c) => {
      seenRbac.push(c.var.rbac)
      return c.json(c.var.rbac ? await c.var.rbac.snapshot() : null)
    })
    app.get('/edit', requirePermission('edit articles'), ok)
    app.get('/edit-and-publish', requirePermission('edit articles', 'publish articles'), ok)
    app.get('/edit-and-publish-array', requirePermission(['edit articles', 'publish articles']), ok)
    app.get('/publish-or-delete', requirePermission('publish articles|delete articles'), ok)
    app.get('/publish-or-delete-any', requirePermission('publish articles', 'delete articles', { any: true }), ok)
    app.get('/unknown-permission', requirePermission('fly'), ok)
    app.get('/exposed', requirePermission('delete articles', { exposeRequirements: true }), ok)
    app.get('/admin', requireRole('admin'), ok)
    app.get('/staff', requireRole('admin|editor'), ok)
    app.get('/staff-args', requireRole('admin', 'editor'), ok)
    app.get('/writer-and-editor', requireRole('writer', 'editor', { all: true }), ok)
    app.get('/admin-or-publish', requireRoleOrPermission('admin|publish articles'), ok)
    app.get(
      '/custom',
      requirePermission('delete articles', {
        onUnauthenticated: (c) => c.redirect('/login'),
        onForbidden: (c, ctx) => c.text(`nope: ${ctx.kind}`, 418),
      }),
      ok,
    )
    app.get(
      '/throws',
      requireRole('admin', {
        onForbidden: () => {
          throw new HTTPException(451, { message: 'unavailable' })
        },
      }),
      ok,
    )

    const custom = createGuards({ onForbidden: (c) => c.body(null, 404) })
    app.get('/hidden', custom.requireRole('admin'), ok)
    app.get('/hidden-undefined', custom.requireRole('admin', { onForbidden: undefined }), ok)

    app.onError(onError)
  })

  const get = (path: string, user?: number) =>
    app.request(path, { headers: user === undefined ? {} : { 'x-user': String(user) } })

  const status = async (path: string, user?: number) => (await get(path, user)).status

  it('sets c.var.rbac (null for guests)', async () => {
    expect(await (await get('/me')).json()).toBeNull()
    expect(await (await get('/me', 2)).json()).toEqual({
      roles: ['writer', 'editor'],
      permissions: ['edit articles', 'publish articles'],
    })
    expect(seenRbac[0]).toBeNull()
  })

  it('returns 401 JSON for guests', async () => {
    const res = await get('/edit')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' })
  })

  it('requirePermission: single, all-of args, pipe = any-of, any option', async () => {
    expect(await status('/edit', 1)).toBe(200)
    expect(await status('/edit', 3)).toBe(403)

    expect(await status('/edit-and-publish', 1)).toBe(403)
    expect(await status('/edit-and-publish', 2)).toBe(200)
    expect(await status('/edit-and-publish-array', 1)).toBe(403)
    expect(await status('/edit-and-publish-array', 2)).toBe(200)

    expect(await status('/publish-or-delete', 1)).toBe(403)
    expect(await status('/publish-or-delete', 2)).toBe(200)
    expect(await status('/publish-or-delete', 3)).toBe(200)
    expect(await status('/publish-or-delete-any', 3)).toBe(200)
    expect(await status('/publish-or-delete-any', 1)).toBe(403)

    expect(await status('/unknown-permission', 3)).toBe(403)
  })

  it('returns 403 JSON without leaking requirements by default', async () => {
    const res = await get('/edit', 3)
    expect(await res.json()).toEqual({
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
    })
    const exposed = await get('/exposed', 1)
    expect(await exposed.json()).toEqual({
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
      required: [['delete articles']],
    })
  })

  it('requireRole: any by default (pipes or args), all option', async () => {
    expect(await status('/admin', 3)).toBe(200)
    expect(await status('/admin', 1)).toBe(403)
    expect(await status('/staff', 2)).toBe(200)
    expect(await status('/staff', 1)).toBe(403)
    expect(await status('/staff-args', 3)).toBe(200)
    expect(await status('/writer-and-editor', 2)).toBe(200)
    expect(await status('/writer-and-editor', 1)).toBe(403)
    expect(await (await get('/admin', 1)).json()).toEqual({
      error: 'FORBIDDEN',
      reason: 'role',
      message: 'User does not have the right roles.',
    })
  })

  it('requireRoleOrPermission', async () => {
    expect(await status('/admin-or-publish', 3)).toBe(200) // role
    expect(await status('/admin-or-publish', 2)).toBe(200) // permission
    expect(await status('/admin-or-publish', 1)).toBe(403)
    expect(await status('/admin-or-publish')).toBe(401)
    expect(await (await get('/admin-or-publish', 1)).json()).toEqual({
      error: 'FORBIDDEN',
      reason: 'role_or_permission',
      message: 'User does not have any of the necessary access rights.',
    })
  })

  it('lets super-admins through permission guards (checks go through can*)', async () => {
    expect(await status('/edit', 4)).toBe(200)
    expect(await status('/edit-and-publish', 4)).toBe(200)
    expect(await status('/unknown-permission', 4)).toBe(200)
  })

  it('supports custom handlers per guard and via createGuards', async () => {
    const guest = await get('/custom')
    expect(guest.status).toBe(302)
    expect(guest.headers.get('location')).toBe('/login')

    const forbidden = await get('/custom', 1)
    expect(forbidden.status).toBe(418)
    expect(await forbidden.text()).toBe('nope: permission')

    expect(await status('/throws', 1)).toBe(451)

    expect(await status('/hidden', 1)).toBe(404)
    expect(await status('/hidden', 3)).toBe(200)
    expect(await status('/hidden')).toBe(401)
    // An option set to `undefined` keeps the createGuards() default instead of resetting it.
    expect(await status('/hidden-undefined', 1)).toBe(404)
  })
})

describe('error handling, teams and guards', () => {
  const app = new Hono()

  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await rbac.createPermission('manage team')
    await rbac.createRole('owner', { team: 1 })
    await rbac.role('owner', { team: 1 }).givePermissionTo('manage team')
    await rbac.for({ type: 'user', id: 1 }, { team: 1 }).assignRole('owner')

    await rbac.createPermission('reports.view', { guard: 'api' })
    await rbac.for({ type: 'client', id: 7 }, { guard: 'api', team: 1 }).givePermissionTo('reports.view')

    app.get('/no-middleware', requirePermission('manage team'), ok)

    const scoped = new Hono<RbacEnv>()
    scoped.use(rbacMiddleware({ rbac, getSubject: userFrom, team: (c) => Number(c.req.header('x-team')) }))
    scoped.get('/manage', requirePermission('manage team'), ok)
    app.route('/team', scoped)

    const api = new Hono<RbacEnv>()
    api.use(
      rbacMiddleware({
        rbac,
        guard: 'api',
        team: () => 1,
        getSubject: (c) => (c.req.header('x-client') ? { type: 'client', id: Number(c.req.header('x-client')) } : null),
      }),
    )
    api.get('/reports', requirePermission('reports.view'), ok)
    app.route('/api', api)

    const failing = new Hono<RbacEnv>()
    failing.use(
      rbacMiddleware({
        rbac,
        getSubject: async () => {
          throw new Error('session store down')
        },
      }),
    )
    failing.get('/x', ok)
    app.route('/failing', failing)

    app.onError(onError)
  })

  it('throws RbacMiddlewareMissingError when the middleware did not run', async () => {
    const res = await app.request('/no-middleware')
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'RBAC_MIDDLEWARE_MISSING' })
    expect(new RbacMiddlewareMissingError().code).toBe('RBAC_MIDDLEWARE_MISSING')
  })

  it('propagates async getSubject errors to onError', async () => {
    const res = await app.request('/failing/x', { headers: { 'x-user': '1' } })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ message: 'session store down' })
  })

  it('scopes checks to the team from the request', async () => {
    const as = (team: number) => app.request('/team/manage', { headers: { 'x-user': '1', 'x-team': String(team) } })
    expect((await as(1)).status).toBe(200)
    expect((await as(2)).status).toBe(403)
  })

  it('uses the configured guard', async () => {
    expect((await app.request('/api/reports', { headers: { 'x-client': '7' } })).status).toBe(200)
    expect((await app.request('/api/reports', { headers: { 'x-client': '8' } })).status).toBe(403)
    expect((await app.request('/api/reports')).status).toBe(401)
  })

  it('rejects guards without names', () => {
    // @ts-expect-error -- no names is also a type error now; the runtime check stays for untyped callers
    expect(() => requirePermission()).toThrow(TypeError)
    // @ts-expect-error options without names is a type error; checked here at runtime
    expect(() => requireRole({ all: true })).toThrow(TypeError)
    expect(() => requireRole(' | ')).toThrow(TypeError)
  })
})

// spatie v8.5 canAny() / canAll(). User 1 is a writer (edit), user 2 a writer + editor (edit, publish).
const CAN_CASES: [path: string, user: number, status: number][] = [
  ['/can-any', 1, 200],
  ['/can-any', 0, 401],
  ['/can-all', 1, 403],
  ['/can-all', 2, 200],
  ['/can-all-pipe', 1, 200], // 'publish|edit' is one entry: either passes it
]

describe('canAny / canAll (spatie v8.5)', () => {
  const app = new Hono<RbacEnv>()
  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await seed(rbac)
    app.use(rbacMiddleware({ rbac, getSubject: async (c) => userFrom(c) }))
    app.get('/can-any', canAny('publish articles', 'edit articles'), ok)
    app.get('/can-all', canAll('edit articles', 'publish articles'), ok)
    app.get('/can-all-pipe', canAll(['edit articles', 'publish articles|edit articles']), ok)
  })

  it.each(CAN_CASES)('%s as user %i → %i', async (path, user, status) => {
    const res = await app.request(path, user ? { headers: { 'x-user': String(user) } } : {})
    expect(res.status).toBe(status)
  })
})

/** User 10 has `admin` and `edit articles` only in guard `api` (spatie's `role:admin,api`). */
async function seedApiGuard(rbac: Rbac): Promise<void> {
  await rbac.createRole('admin')
  await rbac.createRole('admin', { guard: 'api' })
  await rbac.createPermission('edit articles', { guard: 'api' })
  await rbac.for({ type: 'user', id: 10 }, { guard: 'api' }).assignRole('admin')
  await rbac.for({ type: 'user', id: 10 }, { guard: 'api' }).givePermissionTo('edit articles')
}

const GUARD_CASES: [string, number | null, number][] = [
  ['/api/role', 10, 200],
  ['/api/role', null, 401],
  ['/web/role', 10, 403],
  ['/web/role', null, 401],
  ['/api/permission', 10, 200],
  ['/web/permission', 10, 403],
  ['/api/role-or-permission', 10, 200],
  ['/api/can-any', 10, 200],
  ['/api/can-all', 10, 200],
  ['/api/custom', 10, 200],
]

describe('per-route guard option', () => {
  const app = new Hono<RbacEnv>()
  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await seedApiGuard(rbac)
    app.use(rbacMiddleware({ rbac, getSubject: async (c) => userFrom(c) }))
    const guards = createGuards({ exposeRequirements: true })
    app.get('/api/role', requireRole('admin', { guard: 'api' }), (c) => c.json({ guard: c.var.rbac?.guardName }))
    app.get('/web/role', requireRole('admin'), ok)
    app.get('/api/permission', requirePermission('edit articles', { guard: 'api' }), ok)
    app.get('/web/permission', requirePermission('edit articles'), ok)
    app.get('/api/role-or-permission', requireRoleOrPermission('admin|edit articles', { guard: 'api' }), ok)
    app.get('/api/can-any', canAny('edit articles', 'publish articles', { guard: 'api' }), ok)
    app.get('/api/can-all', canAll('edit articles', { guard: 'api' }), ok)
    app.get('/api/custom', guards.requireRole('admin', { guard: 'api' }), ok)
  })

  it.each(GUARD_CASES)('%s as user %s → %i', async (path, user, status) => {
    const res = await app.request(path, user ? { headers: { 'x-user': String(user) } } : {})
    expect(res.status).toBe(status)
  })

  it('leaves `c.var.rbac` in the request guard', async () => {
    const res = await app.request('/api/role', { headers: { 'x-user': '10' } })
    expect(await res.json()).toEqual({ guard: 'web' })
  })
})
