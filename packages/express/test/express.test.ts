import { createRbac, MemoryAdapter, type Rbac } from '@anievo-id/rbac-evolution'
import express, { type ErrorRequestHandler, type Request } from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createGuards,
  rbacMiddleware,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  canAny,
  canAll,
  type RbacRequest,
} from '../src'

type Server = ReturnType<express.Express['listen']>

const ok = (_req: Request, res: express.Response) => {
  res.json({ ok: true })
}

const userFrom = (req: Request) => {
  const id = req.header('x-user')
  return id ? { type: 'user', id: Number(id) } : null
}

async function listen(app: express.Express): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as { port: number }
      resolve({ server, url: `http://127.0.0.1:${port}` })
    })
  })
}

async function seed(rbac: Rbac): Promise<void> {
  for (const p of ['edit articles', 'delete articles', 'publish articles']) await rbac.createPermission(p)
  await rbac.createRole('writer')
  await rbac.createRole('editor')
  await rbac.createRole('admin')
  await rbac.role('writer').givePermissionTo('edit articles')
  await rbac.role('editor').givePermissionTo('edit articles', 'publish articles')
  await rbac.for({ type: 'user', id: 1 }).assignRole('writer') // writer
  await rbac.for({ type: 'user', id: 2 }).assignRole('writer', 'editor') // writer + editor
  await rbac.for({ type: 'user', id: 3 }).assignRole('admin')
  await rbac.for({ type: 'user', id: 3 }).givePermissionTo('delete articles')
}

describe('rbac-evolution-express', () => {
  let server: Server
  let url: string
  const seenRbac: unknown[] = []

  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await seed(rbac)

    const app = express()
    app.use(rbacMiddleware({ rbac, getSubject: async (req) => userFrom(req) }))

    app.get('/me', async (req, res) => {
      seenRbac.push(req.rbac)
      res.json(req.rbac ? await req.rbac.snapshot() : null)
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
        onUnauthenticated: (_req, res) => res.redirect('/login'),
        onForbidden: (_req, res, _next, ctx) => res.status(418).send(`nope: ${ctx.kind}`),
      }),
      ok,
    )

    const custom = createGuards({ onForbidden: (_req, res) => res.status(404).end() })
    app.get('/hidden', custom.requireRole('admin'), ok)
    app.get('/hidden-undefined', custom.requireRole('admin', { onForbidden: undefined }), ok)

    const errors: ErrorRequestHandler = (err: Error & { code?: string }, _req, res, _next) => {
      res.status(500).json({ error: err.code ?? 'ERROR', message: err.message })
    }
    app.use(errors)

    ;({ server, url } = await listen(app))
  })

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  const get = (path: string, user?: number) =>
    fetch(url + path, { headers: user === undefined ? {} : { 'x-user': String(user) }, redirect: 'manual' })

  const status = async (path: string, user?: number) => (await get(path, user)).status

  it('attaches req.rbac (null for guests)', async () => {
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
    expect(await exposed.json()).toMatchObject({ required: [['delete articles']] })
  })

  it('requireRole: any by default (pipes or args), all option', async () => {
    expect(await status('/admin', 3)).toBe(200)
    expect(await status('/admin', 1)).toBe(403)
    expect(await status('/staff', 2)).toBe(200)
    expect(await status('/staff', 1)).toBe(403)
    expect(await status('/staff-args', 3)).toBe(200)
    expect(await status('/writer-and-editor', 2)).toBe(200)
    expect(await status('/writer-and-editor', 1)).toBe(403)
    expect(await (await get('/admin', 1)).json()).toMatchObject({ reason: 'role' })
  })

  it('requireRoleOrPermission', async () => {
    expect(await status('/admin-or-publish', 3)).toBe(200) // role
    expect(await status('/admin-or-publish', 2)).toBe(200) // permission
    expect(await status('/admin-or-publish', 1)).toBe(403)
    expect(await status('/admin-or-publish')).toBe(401)
  })

  it('supports custom handlers per guard and via createGuards', async () => {
    const guest = await get('/custom')
    expect(guest.status).toBe(302)
    expect(guest.headers.get('location')).toBe('/login')

    const forbidden = await get('/custom', 1)
    expect(forbidden.status).toBe(418)
    expect(await forbidden.text()).toBe('nope: permission')

    expect(await status('/hidden', 1)).toBe(404)
    expect(await status('/hidden', 3)).toBe(200)
    expect(await status('/hidden')).toBe(401)
    // An option set to `undefined` keeps the createGuards() default instead of resetting it.
    expect(await status('/hidden-undefined', 1)).toBe(404)
  })
})

describe('error handling', () => {
  let server: Server
  let url: string

  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await rbac.createPermission('manage team')
    await rbac.createRole('owner', { team: 1 })
    await rbac.role('owner', { team: 1 }).givePermissionTo('manage team')
    await rbac.for({ type: 'user', id: 1 }, { team: 1 }).assignRole('owner')

    const app = express()
    app.get('/no-middleware', requirePermission('manage team'), ok)

    const scoped = express.Router()
    scoped.use(
      rbacMiddleware({
        rbac,
        getSubject: userFrom,
        team: (req) => Number(req.header('x-team')),
      }),
    )
    scoped.get('/manage', requirePermission('manage team'), ok)
    app.use('/team', scoped)

    const failing = express.Router()
    failing.use(
      rbacMiddleware({
        rbac,
        getSubject: async () => {
          throw new Error('session store down')
        },
      }),
    )
    failing.get('/x', ok)
    app.use('/failing', failing)

    app.use(((err: Error & { code?: string }, _req, res, _next) => {
      res.status(500).json({ error: err.code ?? 'ERROR', message: err.message })
    }) satisfies ErrorRequestHandler)
    ;({ server, url } = await listen(app))
  })

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('forwards a missing middleware as an error', async () => {
    const res = await fetch(`${url}/no-middleware`)
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'RBAC_MIDDLEWARE_MISSING' })
  })

  it('forwards async getSubject errors to next(err)', async () => {
    const res = await fetch(`${url}/failing/x`, { headers: { 'x-user': '1' } })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ message: 'session store down' })
  })

  it('scopes checks to the team from the request', async () => {
    const as = (team: number) => fetch(`${url}/team/manage`, { headers: { 'x-user': '1', 'x-team': String(team) } })
    expect((await as(1)).status).toBe(200)
    expect((await as(2)).status).toBe(403)
  })

  it('rejects guards without names', () => {
    // @ts-expect-error -- no names is also a type error now; the runtime check stays for untyped callers
    expect(() => requirePermission()).toThrow(TypeError)
    // @ts-expect-error options without names is a type error; checked here at runtime
    expect(() => requireRole({ all: true })).toThrow(TypeError)
    expect(() => requireRole(' | ')).toThrow(TypeError) // used to answer 403 at runtime; now fails at startup like Nuxt/NestJS
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
  let server: Server
  let url: string
  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await seed(rbac)
    const app = express()
    app.use(rbacMiddleware({ rbac, getSubject: async (req) => userFrom(req) }))
    app.get('/can-any', canAny('publish articles', 'edit articles'), ok)
    app.get('/can-all', canAll('edit articles', 'publish articles'), ok)
    app.get('/can-all-pipe', canAll(['edit articles', 'publish articles|edit articles']), ok)
    ;({ server, url } = await listen(app))
  })
  afterAll(() => new Promise<void>((r) => server.close(() => r())))

  it.each(CAN_CASES)('%s as user %i → %i', async (path, user, status) => {
    const res = await fetch(url + path, user ? { headers: { 'x-user': String(user) } } : {})
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
  let server: Server
  let url: string
  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await seedApiGuard(rbac)
    const app = express()
    app.use(rbacMiddleware({ rbac, getSubject: async (req) => userFrom(req) }))
    const guards = createGuards({ exposeRequirements: true })
    app.get('/api/role', requireRole('admin', { guard: 'api' }), (req, res) => {
      res.json({ guard: req.rbac?.guardName })
    })
    app.get('/web/role', requireRole('admin'), ok)
    app.get('/api/permission', requirePermission('edit articles', { guard: 'api' }), ok)
    app.get('/web/permission', requirePermission('edit articles'), ok)
    app.get('/api/role-or-permission', requireRoleOrPermission('admin|edit articles', { guard: 'api' }), ok)
    app.get('/api/can-any', canAny('edit articles', 'publish articles', { guard: 'api' }), ok)
    app.get('/api/can-all', canAll('edit articles', { guard: 'api' }), ok)
    app.get('/api/custom', guards.requireRole('admin', { guard: 'api' }), ok)
    ;({ server, url } = await listen(app))
  })
  afterAll(() => new Promise<void>((r) => server.close(() => r())))

  it.each(GUARD_CASES)('%s as user %s → %i', async (path, user, status) => {
    const res = await fetch(url + path, user ? { headers: { 'x-user': String(user) } } : {})
    expect(res.status).toBe(status)
  })

  it('leaves `req.rbac` in the request guard', async () => {
    const res = await fetch(`${url}/api/role`, { headers: { 'x-user': '10' } })
    expect(await res.json()).toEqual({ guard: 'web' })
  })
})

describe('typed engine (RbacMiddlewareOptions<T>, RbacRequest<T>, createGuards<T>() handlers)', () => {
  type AppRbac = {
    permissions: 'edit articles' | 'delete articles' | 'publish articles'
    roles: 'writer' | 'editor' | 'admin'
  }
  let server: Server
  let url: string
  const forbidden: unknown[] = []

  beforeAll(async () => {
    const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
    await seed(rbac)
    const app = express()
    app.use(rbacMiddleware({ rbac, getSubject: async (req) => userFrom(req) }))
    const guards = createGuards<typeof rbac>({
      onForbidden: async (req, res) => {
        forbidden.push(req.rbac)
        res.status(403).json({ roles: await req.rbac?.getRoleNames() })
      },
    })
    app.get('/edit', guards.requirePermission('edit articles'), async (req: RbacRequest<typeof rbac>, res) => {
      res.json({ publish: await req.rbac?.can('publish articles'), guard: req.rbac?.guardName })
    })
    app.get('/admin', guards.requireRole('admin'), ok)
    ;({ server, url } = await listen(app))
  })
  afterAll(() => new Promise<void>((r) => server.close(() => r())))

  it('sets req.rbac from a typed engine, the same as an untyped one', async () => {
    const writer = await fetch(`${url}/edit`, { headers: { 'x-user': '1' } })
    expect(await writer.json()).toEqual({ publish: false, guard: 'web' })
    const editor = await fetch(`${url}/edit`, { headers: { 'x-user': '2' } })
    expect(await editor.json()).toEqual({ publish: true, guard: 'web' })
  })

  it('hands the typed handlers of createGuards<T>() the request subject', async () => {
    const res = await fetch(`${url}/admin`, { headers: { 'x-user': '2' } })
    expect(res.status).toBe(403)
    expect(((await res.json()) as { roles: string[] }).roles.sort()).toEqual(['editor', 'writer'])
    expect(forbidden).toHaveLength(1)
    expect(forbidden[0]).toMatchObject({ subject: { type: 'user', id: 2 } })
    expect((await fetch(`${url}/admin`, { headers: { 'x-user': '3' } })).status).toBe(200)
  })
})
