import { createRbac, MemoryAdapter, type Rbac } from '@anievo-id/rbac-evolution'
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createGuards,
  rbacPlugin,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  canAny,
  canAll,
} from '../src'

const ok = async () => ({ ok: true })

const userFrom = (request: FastifyRequest) => {
  const id = request.headers['x-user']
  return typeof id === 'string' ? { type: 'user', id: Number(id) } : null
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

const errorHandler = (err: FastifyError, _request: FastifyRequest, reply: FastifyReply) =>
  reply.code(err.statusCode ?? 500).send({ error: err.code, message: err.message })

describe('rbac-evolution-fastify', () => {
  let app: FastifyInstance
  const seenRbac: unknown[] = []

  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), superAdminRoles: ['super-admin'] })
    await seed(rbac)

    app = Fastify()
    await app.register(rbacPlugin, { rbac, getSubject: async (request) => userFrom(request) })

    app.get('/me', async (request) => {
      seenRbac.push(request.rbac)
      return request.rbac ? request.rbac.snapshot() : null
    })
    app.get('/edit', { preHandler: requirePermission('edit articles') }, ok)
    app.get('/edit-and-publish', { preHandler: requirePermission('edit articles', 'publish articles') }, ok)
    app.get('/edit-and-publish-array', { preHandler: requirePermission(['edit articles', 'publish articles']) }, ok)
    app.get('/publish-or-delete', { preHandler: requirePermission('publish articles|delete articles') }, ok)
    app.get(
      '/publish-or-delete-any',
      { preHandler: requirePermission('publish articles', 'delete articles', { any: true }) },
      ok,
    )
    app.get('/unknown-permission', { preHandler: requirePermission('fly') }, ok)
    app.get('/exposed', { preHandler: requirePermission('delete articles', { exposeRequirements: true }) }, ok)
    app.get('/admin', { preHandler: requireRole('admin') }, ok)
    app.get('/staff', { preHandler: requireRole('admin|editor') }, ok)
    app.get('/staff-args', { preHandler: requireRole('admin', 'editor') }, ok)
    app.get('/writer-and-editor', { preHandler: requireRole('writer', 'editor', { all: true }) }, ok)
    app.get('/admin-or-publish', { preHandler: requireRoleOrPermission('admin|publish articles') }, ok)
    app.get('/chained', { preHandler: [requireRole('writer'), requirePermission('publish articles')] }, ok)
    app.get(
      '/custom',
      {
        preHandler: requirePermission('delete articles', {
          onUnauthenticated: (_request, reply) => reply.redirect('/login'),
          onForbidden: async (_request, reply, ctx) => reply.code(418).send(`nope: ${ctx.kind}`),
        }),
      },
      ok,
    )
    app.get(
      '/throws',
      {
        preHandler: requireRole('admin', {
          onForbidden: () => {
            throw Object.assign(new Error('unavailable'), { statusCode: 451, code: 'UNAVAILABLE' })
          },
        }),
      },
      ok,
    )

    const custom = createGuards({ onForbidden: (_request, reply) => reply.code(404).send() })
    app.get('/hidden', { preHandler: custom.requireRole('admin') }, ok)
    app.get('/hidden-undefined', { preHandler: custom.requireRole('admin', { onForbidden: undefined }) }, ok)

    app.setErrorHandler(errorHandler)
    await app.ready()
  })

  afterAll(() => app.close())

  const get = (url: string, user?: number) =>
    app.inject({ method: 'GET', url, headers: user === undefined ? {} : { 'x-user': String(user) } })

  const status = async (url: string, user?: number) => (await get(url, user)).statusCode

  it('decorates request.rbac (null for guests)', async () => {
    expect((await get('/me')).json()).toBeNull()
    expect((await get('/me', 2)).json()).toEqual({
      roles: ['writer', 'editor'],
      permissions: ['edit articles', 'publish articles'],
    })
    expect(seenRbac[0]).toBeNull()
  })

  it('returns 401 JSON for guests', async () => {
    const res = await get('/edit')
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' })
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
    expect((await get('/edit', 3)).json()).toEqual({
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
    })
    expect((await get('/exposed', 1)).json()).toEqual({
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
    expect((await get('/admin', 1)).json()).toEqual({
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
    expect((await get('/admin-or-publish', 1)).json()).toEqual({
      error: 'FORBIDDEN',
      reason: 'role_or_permission',
      message: 'User does not have any of the necessary access rights.',
    })
  })

  it('runs several guards in a preHandler array', async () => {
    expect(await status('/chained', 2)).toBe(200)
    expect((await get('/chained', 1)).json()).toMatchObject({ reason: 'permission' })
    expect((await get('/chained', 3)).json()).toMatchObject({ reason: 'role' })
  })

  it('lets super-admins through permission guards (checks go through can*)', async () => {
    expect(await status('/edit', 4)).toBe(200)
    expect(await status('/edit-and-publish', 4)).toBe(200)
    expect(await status('/unknown-permission', 4)).toBe(200)
  })

  it('supports custom handlers per guard and via createGuards', async () => {
    const guest = await get('/custom')
    expect(guest.statusCode).toBe(302)
    expect(guest.headers.location).toBe('/login')

    const forbidden = await get('/custom', 1)
    expect(forbidden.statusCode).toBe(418)
    expect(forbidden.body).toBe('nope: permission')

    expect(await status('/throws', 1)).toBe(451)

    expect(await status('/hidden', 1)).toBe(404)
    expect(await status('/hidden', 3)).toBe(200)
    expect(await status('/hidden')).toBe(401)
    // An option set to `undefined` keeps the createGuards() default instead of resetting it.
    expect(await status('/hidden-undefined', 1)).toBe(404)
  })
})

describe('error handling, scopes, teams and guards', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await rbac.createPermission('manage team')
    await rbac.createRole('owner', { team: 1 })
    await rbac.role('owner', { team: 1 }).givePermissionTo('manage team')
    await rbac.for({ type: 'user', id: 1 }, { team: 1 }).assignRole('owner')

    await rbac.createPermission('reports.view', { guard: 'api' })
    await rbac.for({ type: 'client', id: 7 }, { guard: 'api', team: 1 }).givePermissionTo('reports.view')

    app = Fastify()
    app.setErrorHandler(errorHandler)

    app.get('/no-plugin', { preHandler: requirePermission('manage team') }, ok)

    await app.register(
      async (scope) => {
        await scope.register(rbacPlugin, {
          rbac,
          getSubject: userFrom,
          team: (request) => Number(request.headers['x-team']),
        })
        scope.get('/manage', { preHandler: requirePermission('manage team') }, ok)
      },
      { prefix: '/team' },
    )

    await app.register(
      async (scope) => {
        await scope.register(rbacPlugin, {
          rbac,
          guard: 'api',
          team: () => 1,
          hook: 'onRequest',
          getSubject: (request) => {
            const id = request.headers['x-client']
            return typeof id === 'string' ? { type: 'client', id: Number(id) } : null
          },
        })
        scope.get('/reports', { preHandler: requirePermission('reports.view') }, ok)
      },
      { prefix: '/api' },
    )

    await app.register(
      async (scope) => {
        await scope.register(rbacPlugin, {
          rbac,
          getSubject: async () => {
            throw new Error('session store down')
          },
        })
        scope.get('/x', ok)
      },
      { prefix: '/failing' },
    )

    await app.ready()
  })

  afterAll(() => app.close())

  it('throws RbacMiddlewareMissingError when the plugin did not run', async () => {
    const res = await app.inject('/no-plugin')
    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({ error: 'RBAC_MIDDLEWARE_MISSING' })
  })

  it('forwards async getSubject errors to the error handler', async () => {
    const res = await app.inject({ url: '/failing/x', headers: { 'x-user': '1' } })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({ message: 'session store down' })
  })

  it('scopes checks to the team from the request', async () => {
    const as = (team: number) => app.inject({ url: '/team/manage', headers: { 'x-user': '1', 'x-team': String(team) } })
    expect((await as(1)).statusCode).toBe(200)
    expect((await as(2)).statusCode).toBe(403)
  })

  it('uses the configured guard and hook', async () => {
    expect((await app.inject({ url: '/api/reports', headers: { 'x-client': '7' } })).statusCode).toBe(200)
    expect((await app.inject({ url: '/api/reports', headers: { 'x-client': '8' } })).statusCode).toBe(403)
    expect((await app.inject('/api/reports')).statusCode).toBe(401)
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
  let app: FastifyInstance
  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await seed(rbac)
    app = Fastify()
    await app.register(rbacPlugin, { rbac, getSubject: async (request) => userFrom(request) })
    app.get('/can-any', { preHandler: canAny('publish articles', 'edit articles') }, ok)
    app.get('/can-all', { preHandler: canAll('edit articles', 'publish articles') }, ok)
    app.get('/can-all-pipe', { preHandler: canAll(['edit articles', 'publish articles|edit articles']) }, ok)
    await app.ready()
  })
  afterAll(() => app.close())

  it.each(CAN_CASES)('%s as user %i → %i', async (path, user, status) => {
    const res = await app.inject({ url: path, headers: user ? { 'x-user': String(user) } : {} })
    expect(res.statusCode).toBe(status)
  })
})
