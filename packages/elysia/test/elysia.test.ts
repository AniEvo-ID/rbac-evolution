import { createRbac, MemoryAdapter, type Rbac, type Subject } from '@anievo-id/rbac-evolution'
import { Elysia } from 'elysia'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  canAll,
  canAny,
  createGuards,
  RbacPluginMissingError,
  rbacPlugin,
  type RbacRequestContext,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
} from '../src'

const ok = () => ({ ok: true })

const userFrom = ({ headers }: RbacRequestContext): Subject | null =>
  headers['x-user'] ? { type: 'user', id: Number(headers['x-user']) } : null

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

type App = { handle: (request: Request) => Promise<Response> }

const request = (app: App, path: string, headers: Record<string, string> = {}) =>
  app.handle(new Request(`http://localhost${path}`, { headers }))

const asUser = (user?: number): Record<string, string> => (user === undefined ? {} : { 'x-user': String(user) })

describe('rbac-evolution-elysia', () => {
  let app: App

  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), superAdminRoles: ['super-admin'] })
    await seed(rbac)
    const custom = createGuards({ onForbidden: () => new Response(null, { status: 404 }) })

    app = new Elysia()
      .use(rbacPlugin({ rbac, getSubject: userFrom }))
      .get('/me', async ({ rbac }) => (rbac ? await rbac.snapshot() : null))
      .get('/edit', ok, { beforeHandle: requirePermission('edit articles') })
      .get('/edit-and-publish', ok, { beforeHandle: requirePermission('edit articles', 'publish articles') })
      .get('/edit-and-publish-array', ok, { beforeHandle: requirePermission(['edit articles', 'publish articles']) })
      .get('/publish-or-delete', ok, { beforeHandle: requirePermission('publish articles|delete articles') })
      .get('/publish-or-delete-any', ok, {
        beforeHandle: requirePermission('publish articles', 'delete articles', { any: true }),
      })
      .get('/unknown-permission', ok, { beforeHandle: requirePermission('fly') })
      .get('/exposed', ok, { beforeHandle: requirePermission('delete articles', { exposeRequirements: true }) })
      .get('/admin', ok, { beforeHandle: requireRole('admin') })
      .get('/staff', ok, { beforeHandle: requireRole('admin|editor') })
      .get('/staff-args', ok, { beforeHandle: requireRole('admin', 'editor') })
      .get('/writer-and-editor', ok, { beforeHandle: requireRole('writer', 'editor', { all: true }) })
      .get('/admin-or-publish', ok, { beforeHandle: requireRoleOrPermission('admin|publish articles') })
      .get('/custom', ok, {
        beforeHandle: requirePermission('delete articles', {
          onUnauthenticated: () => Response.redirect('http://localhost/login', 302),
          onForbidden: (_ctx, context) => new Response(`nope: ${context.kind}`, { status: 418 }),
        }),
      })
      .get('/hidden', ok, { beforeHandle: custom.requireRole('admin') })
      .get('/hidden-undefined', ok, { beforeHandle: custom.requireRole('admin', { onForbidden: undefined }) })
      .guard({ beforeHandle: requireRole('admin') }, (group) => group.get('/group/a', ok).get('/group/b', ok))
  })

  const get = (path: string, user?: number) => request(app, path, asUser(user))
  const status = async (path: string, user?: number) => (await get(path, user)).status

  it('adds rbac to the context (null for guests)', async () => {
    expect(await (await get('/me')).text()).toBe('')
    expect(await (await get('/me', 2)).json()).toEqual({
      roles: ['writer', 'editor'],
      permissions: ['edit articles', 'publish articles'],
    })
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
    expect(await (await get('/edit', 3)).json()).toEqual({
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
    })
    expect(await (await get('/exposed', 1)).json()).toEqual({
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
    expect(await status('/admin-or-publish', 3)).toBe(200)
    expect(await status('/admin-or-publish', 2)).toBe(200)
    expect(await status('/admin-or-publish', 1)).toBe(403)
    expect(await status('/admin-or-publish')).toBe(401)
    expect(await (await get('/admin-or-publish', 1)).json()).toMatchObject({ reason: 'role_or_permission' })
  })

  it('lets super-admins through permission guards', async () => {
    expect(await status('/edit', 4)).toBe(200)
    expect(await status('/unknown-permission', 4)).toBe(200)
  })

  it('supports custom handlers per guard and via createGuards', async () => {
    const guest = await get('/custom')
    expect(guest.status).toBe(302)
    expect(guest.headers.get('location')).toBe('http://localhost/login')
    const forbidden = await get('/custom', 1)
    expect(forbidden.status).toBe(418)
    expect(await forbidden.text()).toBe('nope: permission')
    expect(await status('/hidden', 1)).toBe(404)
    expect(await status('/hidden', 3)).toBe(200)
    expect(await status('/hidden')).toBe(401)
    // An option set to `undefined` keeps the createGuards() default instead of resetting it.
    expect(await status('/hidden-undefined', 1)).toBe(404)
  })

  it('guards a route group with app.guard()', async () => {
    expect(await status('/group/a', 3)).toBe(200)
    expect(await status('/group/b', 1)).toBe(403)
    expect(await status('/group/b')).toBe(401)
  })
})

describe('errors, teams and guards', () => {
  let app: App

  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await rbac.createPermission('manage team')
    await rbac.createRole('owner', { team: 1 })
    await rbac.role('owner', { team: 1 }).givePermissionTo('manage team')
    await rbac.for({ type: 'user', id: 1 }, { team: 1 }).assignRole('owner')
    await rbac.createPermission('reports.view', { guard: 'api' })
    await rbac.for({ type: 'client', id: 7 }, { guard: 'api', team: 1 }).givePermissionTo('reports.view')

    const team = new Elysia({ prefix: '/team' })
      .use(rbacPlugin({ rbac, getSubject: userFrom, team: ({ headers }) => Number(headers['x-team']) }))
      .get('/manage', ok, { beforeHandle: requirePermission('manage team') })

    const api = new Elysia({ prefix: '/api' })
      .use(
        rbacPlugin({
          rbac,
          name: 'rbac-api',
          guard: 'api',
          team: () => 1,
          getSubject: ({ headers }) => (headers['x-client'] ? { type: 'client', id: Number(headers['x-client']) } : null),
        }),
      )
      .get('/reports', ok, { beforeHandle: requirePermission('reports.view') })

    const failing = new Elysia({ prefix: '/failing' })
      .use(
        rbacPlugin({
          rbac,
          name: 'rbac-failing',
          getSubject: async () => {
            throw new Error('session store down')
          },
        }),
      )
      .get('/x', ok)

    app = new Elysia()
      .onError(({ error }) => {
        const err = error as Error & { code?: string }
        return Response.json({ error: err.code ?? 'ERROR', message: err.message }, { status: 500 })
      })
      .get('/no-plugin', ok, { beforeHandle: requirePermission('manage team') })
      .use(team)
      .use(api)
      .use(failing)
  })

  it('throws RbacPluginMissingError when the plugin did not run', async () => {
    const res = await request(app, '/no-plugin')
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ message: expect.stringContaining('rbacPlugin()') })
    expect(new RbacPluginMissingError().code).toBe('RBAC_PLUGIN_MISSING')
  })

  it('propagates getSubject errors to onError', async () => {
    const res = await request(app, '/failing/x', { 'x-user': '1' })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ message: 'session store down' })
  })

  it('scopes checks to the team from the request', async () => {
    expect((await request(app, '/team/manage', { 'x-user': '1', 'x-team': '1' })).status).toBe(200)
    expect((await request(app, '/team/manage', { 'x-user': '1', 'x-team': '2' })).status).toBe(403)
  })

  it('uses the configured guard', async () => {
    expect((await request(app, '/api/reports', { 'x-client': '7' })).status).toBe(200)
    expect((await request(app, '/api/reports', { 'x-client': '8' })).status).toBe(403)
    expect((await request(app, '/api/reports')).status).toBe(401)
  })

  it('rejects guards without names', () => {
    // @ts-expect-error -- no names is a type error; the runtime check stays for untyped callers
    expect(() => requirePermission()).toThrow(TypeError)
    // @ts-expect-error options without names is a type error; checked here at runtime
    expect(() => requireRole({ all: true })).toThrow(TypeError)
    expect(() => requireRole(' | ')).toThrow(TypeError)
  })
})

describe('canAny / canAll (spatie v8.5)', () => {
  let app: App
  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await seed(rbac)
    app = new Elysia()
      .use(rbacPlugin({ rbac, getSubject: userFrom }))
      .get('/can-any', ok, { beforeHandle: canAny('publish articles', 'edit articles') })
      .get('/can-all', ok, { beforeHandle: canAll('edit articles', 'publish articles') })
      .get('/can-all-pipe', ok, { beforeHandle: canAll(['edit articles', 'publish articles|edit articles']) })
  })

  it.each([
    ['/can-any', 1, 200],
    ['/can-any', undefined, 401],
    ['/can-all', 1, 403],
    ['/can-all', 2, 200],
    ['/can-all-pipe', 1, 200],
  ] as const)('%s as user %s → %i', async (path, user, code) => {
    expect((await request(app, path, asUser(user))).status).toBe(code)
  })
})

describe('per-route guard option', () => {
  let app: App
  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await rbac.createRole('admin')
    await rbac.createRole('admin', { guard: 'api' })
    await rbac.createPermission('edit articles', { guard: 'api' })
    await rbac.for({ type: 'user', id: 10 }, { guard: 'api' }).assignRole('admin')
    await rbac.for({ type: 'user', id: 10 }, { guard: 'api' }).givePermissionTo('edit articles')
    app = new Elysia()
      .use(rbacPlugin({ rbac, getSubject: userFrom }))
      .get('/api/role', ({ rbac }) => ({ guard: rbac?.guardName }), { beforeHandle: requireRole('admin', { guard: 'api' }) })
      .get('/web/role', ok, { beforeHandle: requireRole('admin') })
      .get('/api/permission', ok, { beforeHandle: requirePermission('edit articles', { guard: 'api' }) })
      .get('/api/can-any', ok, { beforeHandle: canAny('edit articles', 'publish articles', { guard: 'api' }) })
  })

  it.each([
    ['/api/role', 10, 200],
    ['/web/role', 10, 403],
    ['/api/permission', 10, 200],
    ['/api/can-any', 10, 200],
  ] as const)('%s as user %i → %i', async (path, user, code) => {
    expect((await request(app, path, asUser(user))).status).toBe(code)
  })

  it('leaves rbac in the request guard', async () => {
    expect(await (await request(app, '/api/role', asUser(10))).json()).toEqual({ guard: 'web' })
  })
})

describe('typed engine', () => {
  type AppRbac = {
    permissions: 'edit articles' | 'delete articles' | 'publish articles'
    roles: 'writer' | 'editor' | 'admin' | 'super-admin'
  }
  const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
  const forbidden: unknown[] = []
  let app: App

  beforeAll(async () => {
    await seed(rbac as unknown as Rbac)
    const guards = createGuards<typeof rbac>({
      onForbidden: async ({ rbac }) => {
        forbidden.push(rbac)
        return Response.json({ roles: ((await rbac?.getRoleNames()) ?? []).sort() }, { status: 403 })
      },
    })
    app = new Elysia()
      .use(rbacPlugin({ rbac, getSubject: userFrom }))
      .get('/edit', async ({ rbac }) => ({ publish: await rbac?.can('publish articles') }), {
        beforeHandle: guards.requirePermission('edit articles'),
      })
      .get('/admin', ok, { beforeHandle: guards.requireRole('admin') })
  })

  it('types rbac with the engine names', async () => {
    expect(await (await request(app, '/edit', asUser(1))).json()).toEqual({ publish: false })
    expect(await (await request(app, '/edit', asUser(2))).json()).toEqual({ publish: true })
  })

  it('hands the typed handlers the request subject', async () => {
    const res = await request(app, '/admin', asUser(2))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ roles: ['editor', 'writer'] })
    expect(forbidden[0]).toMatchObject({ subject: { type: 'user', id: 2 } })
    expect((await request(app, '/admin', asUser(3))).status).toBe(200)
  })
})
