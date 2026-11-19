import { createRbac, MemoryAdapter, type Rbac, type Subject } from '@anievo-id/rbac-evolution'
import { createStaticHandler, isRouteErrorResponse, type LoaderFunctionArgs, type StaticHandlerContext } from 'react-router'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createRbacServer, type RouteArgs } from '../src'

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

const userFrom = ({ request }: RouteArgs): Subject | null => {
  const id = request.headers.get('x-user')
  return id ? { type: 'user', id: Number(id) } : null
}

const argsFor = (user?: number, path = '/'): RouteArgs => ({
  request: new Request(`http://localhost${path}`, { headers: user === undefined ? {} : { 'x-user': String(user) } }),
  params: {},
  context: {},
})

/** The `Response` a guard throws (or `'passed'`). */
async function outcome(run: Promise<unknown>): Promise<Response | 'passed'> {
  try {
    await run
    return 'passed'
  } catch (thrown) {
    if (thrown instanceof Response) return thrown
    throw thrown
  }
}

const status = async (run: Promise<unknown>) => {
  const result = await outcome(run)
  return result === 'passed' ? 200 : result.status
}

describe('createRbacServer', () => {
  const rbac = createRbac({ adapter: new MemoryAdapter(), superAdminRoles: ['super-admin'] })
  const server = createRbacServer({ rbac, getSubject: userFrom })
  beforeAll(() => seed(rbac))

  it('getRbac: the subject, or null for guests; resolved once per request', async () => {
    expect(await server.getRbac(argsFor())).toBeNull()
    const getSubject = vi.fn(userFrom)
    const counted = createRbacServer({ rbac, getSubject })
    const args = argsFor(2)
    const subject = await counted.getRbac(args)
    expect(subject?.subject).toEqual({ type: 'user', id: 2 })
    await counted.requirePermission(args, 'edit articles')
    await counted.getSnapshot(args)
    expect(getSubject).toHaveBeenCalledTimes(1)
  })

  it('getSnapshot: roles and permissions, null for guests, checkBefore and guard', async () => {
    expect(await server.getSnapshot(argsFor())).toBeNull()
    expect(await server.getSnapshot(argsFor(2))).toEqual({
      roles: ['writer', 'editor'],
      permissions: ['edit articles', 'publish articles'],
    })
    const denying = createRbacServer({
      rbac: createRbac({ adapter: rbac.adapter, before: ({ permission }) => (permission === 'publish articles' ? false : undefined) }),
      getSubject: userFrom,
    })
    expect((await denying.getSnapshot(argsFor(2), { checkBefore: ['publish articles'] }))?.denied).toEqual(['publish articles'])
    expect(await server.getSnapshot(argsFor(2), { guard: 'api' })).toEqual({ roles: [], permissions: [] })
  })

  it('throws a 401 JSON Response for guests', async () => {
    const res = await outcome(server.requirePermission(argsFor(), 'edit articles'))
    expect(res).toBeInstanceOf(Response)
    const response = res as Response
    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' })
  })

  it('requirePermission: resolves to the subject; all-of args, pipe = any-of, any option', async () => {
    const subject = await server.requirePermission(argsFor(1), 'edit articles')
    expect(subject.subject).toEqual({ type: 'user', id: 1 })
    expect(await status(server.requirePermission(argsFor(3), 'edit articles'))).toBe(403)
    expect(await status(server.requirePermission(argsFor(1), 'edit articles', 'publish articles'))).toBe(403)
    expect(await status(server.requirePermission(argsFor(2), ['edit articles', 'publish articles']))).toBe(200)
    expect(await status(server.requirePermission(argsFor(3), 'publish articles|delete articles'))).toBe(200)
    expect(await status(server.requirePermission(argsFor(3), 'publish articles', 'delete articles', { any: true }))).toBe(200)
    expect(await status(server.requirePermission(argsFor(1), 'publish articles', 'delete articles', { any: true }))).toBe(403)
    expect(await status(server.requirePermission(argsFor(4), 'fly'))).toBe(200) // super-admin
  })

  it('403 body without requirements by default, with them when exposed', async () => {
    const res = (await outcome(server.requirePermission(argsFor(3), 'edit articles'))) as Response
    expect(await res.json()).toEqual({
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
    })
    const exposed = (await outcome(server.requirePermission(argsFor(1), 'delete articles', { exposeRequirements: true }))) as Response
    expect(await exposed.json()).toMatchObject({ required: [['delete articles']] })
  })

  it('requireRole, requireRoleOrPermission, canAny, canAll', async () => {
    expect(await status(server.requireRole(argsFor(3), 'admin'))).toBe(200)
    expect(await status(server.requireRole(argsFor(2), 'admin|editor'))).toBe(200)
    expect(await status(server.requireRole(argsFor(1), 'admin', 'editor'))).toBe(403)
    expect(await status(server.requireRole(argsFor(2), 'writer', 'editor', { all: true }))).toBe(200)
    expect(await status(server.requireRole(argsFor(1), 'writer', 'editor', { all: true }))).toBe(403)
    expect(await status(server.requireRoleOrPermission(argsFor(3), 'admin|publish articles'))).toBe(200)
    expect(await status(server.requireRoleOrPermission(argsFor(2), 'admin|publish articles'))).toBe(200)
    const res = (await outcome(server.requireRoleOrPermission(argsFor(1), 'admin|publish articles'))) as Response
    expect(await res.json()).toMatchObject({ reason: 'role_or_permission' })
    expect(await status(server.canAny(argsFor(1), 'publish articles', 'edit articles'))).toBe(200)
    expect(await status(server.canAll(argsFor(1), 'edit articles', 'publish articles'))).toBe(403)
    expect(await status(server.canAll(argsFor(2), 'edit articles', 'publish articles'))).toBe(200)
  })

  it('rejects guards without names', async () => {
    // @ts-expect-error -- no names is a type error; the runtime check stays for untyped callers
    await expect(server.requirePermission(argsFor(1))).rejects.toThrow(TypeError)
    // @ts-expect-error options without names is a type error
    await expect(server.requireRole(argsFor(1), { all: true })).rejects.toThrow(TypeError)
  })
})

describe('redirects and custom handlers', () => {
  const rbac = createRbac({ adapter: new MemoryAdapter() })
  beforeAll(() => seed(rbac))

  it('redirects with the server defaults, a guard option wins', async () => {
    const server = createRbacServer({
      rbac,
      getSubject: userFrom,
      unauthenticatedRedirect: ({ request }) => `/login?redirectTo=${new URL(request.url).pathname}`,
      forbiddenRedirect: '/denied',
    })
    const guest = (await outcome(server.requireRole(argsFor(undefined, '/admin'), 'admin'))) as Response
    expect(guest.status).toBe(302)
    expect(guest.headers.get('location')).toBe('/login?redirectTo=/admin')
    const denied = (await outcome(server.requireRole(argsFor(1), 'admin'))) as Response
    expect(denied.headers.get('location')).toBe('/denied')
    const own = (await outcome(server.requireRole(argsFor(1), 'admin', { forbiddenRedirect: '/upgrade' }))) as Response
    expect(own.headers.get('location')).toBe('/upgrade')
  })

  it('handlers return or throw the Response to send; they win over redirects', async () => {
    const server = createRbacServer({
      rbac,
      getSubject: userFrom,
      unauthenticatedRedirect: '/login',
      onForbidden: (_args, { kind }) => new Response(`nope: ${kind}`, { status: 404 }),
    })
    const hidden = (await outcome(server.requireRole(argsFor(1), 'admin'))) as Response
    expect(hidden.status).toBe(404)
    expect(await hidden.text()).toBe('nope: role')
    const thrown = (await outcome(
      server.requireRole(argsFor(), 'admin', {
        onUnauthenticated: () => {
          throw new Response(null, { status: 418 })
        },
      }),
    )) as Response
    expect(thrown.status).toBe(418)
    // An option set to `undefined` keeps the server default.
    expect(await status(server.requireRole(argsFor(1), 'admin', { onForbidden: undefined }))).toBe(404)
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

  it('scopes checks to the team of the request', async () => {
    const server = createRbacServer({
      rbac,
      getSubject: userFrom,
      team: ({ request }) => Number(new URL(request.url).searchParams.get('team')),
    })
    expect(await status(server.requirePermission(argsFor(1, '/?team=1'), 'manage team'))).toBe(200)
    expect(await status(server.requirePermission(argsFor(1, '/?team=2'), 'manage team'))).toBe(403)
  })

  it('uses the server guard, or a guard per call', async () => {
    const api = createRbacServer({ rbac, getSubject: userFrom, guard: 'api', team: () => 1 })
    expect(await status(api.requireRole(argsFor(10), 'admin'))).toBe(200)
    const web = createRbacServer({ rbac, getSubject: userFrom, team: () => 1 })
    expect(await status(web.requireRole(argsFor(10), 'admin'))).toBe(403)
    const scoped = await web.requireRole(argsFor(10), 'admin', { guard: 'api' })
    expect(scoped.guardName).toBe('api')
  })
})

describe('in React Router (createStaticHandler)', () => {
  const rbac = createRbac({ adapter: new MemoryAdapter() })
  const server = createRbacServer({ rbac, getSubject: userFrom })
  const handler = createStaticHandler([
    {
      id: 'root',
      path: '/',
      loader: (args: LoaderFunctionArgs) => server.getSnapshot(args),
      children: [
        {
          id: 'admin',
          path: 'admin',
          ErrorBoundary: () => null,
          loader: async (args: LoaderFunctionArgs) => {
            await server.requireRole(args, 'admin')
            return { ok: true }
          },
        },
        {
          id: 'login-first',
          path: 'account',
          loader: async (args: LoaderFunctionArgs) => {
            await server.requirePermission(args, 'edit articles', { unauthenticatedRedirect: '/login' })
            return null
          },
        },
      ],
    },
  ])
  beforeAll(() => seed(rbac))

  const query = (path: string, user?: number) =>
    handler.query(new Request(`http://localhost${path}`, { headers: user === undefined ? {} : { 'x-user': String(user) } }))

  it('passes, with the snapshot from the root loader', async () => {
    const context = (await query('/admin', 3)) as StaticHandlerContext
    expect(context.statusCode).toBe(200)
    expect(context.loaderData).toEqual({ root: { roles: ['admin'], permissions: ['delete articles'] }, admin: { ok: true } })
  })

  it('a 403 reaches the error boundary as a route error response', async () => {
    const context = (await query('/admin', 1)) as StaticHandlerContext
    expect(context.statusCode).toBe(403)
    const error = context.errors?.admin
    expect(isRouteErrorResponse(error)).toBe(true)
    expect(error).toMatchObject({ status: 403, data: { error: 'FORBIDDEN', reason: 'role' } })
  })

  it('a redirect is a redirect', async () => {
    const res = (await query('/account')) as Response
    expect(res).toBeInstanceOf(Response)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
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
    const subject = await server.requirePermission(argsFor(2), 'edit articles')
    expect(await subject.can('publish articles')).toBe(true)
    // @ts-expect-error a typo in a permission name is a type error
    await expect(server.requirePermission(argsFor(2), 'edit artcles')).rejects.toBeInstanceOf(Response)
    // @ts-expect-error a role name is not a permission
    await expect(server.requirePermission(argsFor(2), 'admin')).rejects.toBeInstanceOf(Response)
  })
})
