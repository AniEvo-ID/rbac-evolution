import type { Rbac } from '@anievo-id/rbac-evolution'
import { isHttpError, isRedirect, type RequestEvent } from '@sveltejs/kit'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  canAll,
  canAny,
  createGuards,
  getRbac,
  getSnapshot,
  type RbacHandle,
  RbacHandleMissingError,
  rbacHandle,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
} from '../../src/server/index.js'
import { fakeEvent, seededRbac } from './fixtures.js'

let rbac: Rbac

beforeAll(async () => {
  rbac = await seededRbac()
})

/** Runs the hook like SvelteKit does and returns the event, with `event.locals.rbac` set. */
async function handled(user?: number, path?: string, handle?: RbacHandle): Promise<RequestEvent> {
  const event = fakeEvent(user, path)
  const hook =
    handle ??
    rbacHandle({ rbac, getSubject: (e) => ((e.locals as { user?: number }).user === undefined ? null : { type: 'user', id: (e.locals as { user: number }).user }) })
  await hook({ event, resolve: async () => new Response('ok') })
  return event
}

/** The value a guard threw (or `undefined` when it passed). */
const thrown = (promise: Promise<unknown>): Promise<unknown> => promise.then(() => undefined, (e: unknown) => e)

describe('rbacHandle', () => {
  it('sets event.locals.rbac to the subject, or null for guests, and resolves the request', async () => {
    const resolve = vi.fn(async () => new Response('ok'))
    const event = fakeEvent(1)
    const response = await rbacHandle({ rbac, getSubject: () => ({ type: 'user', id: 1 }) })({ event, resolve })
    expect(await response.text()).toBe('ok')
    expect(resolve).toHaveBeenCalledWith(event)
    expect(await getRbac(event)?.hasRole('writer')).toBe(true)

    const guest = await handled()
    expect(guest.locals).toEqual({ rbac: null })
    expect(getRbac(guest)).toBeNull()
  })

  it('scopes the subject to the hook’s guard and team', async () => {
    const teams = await (async () => {
      const { createRbac, MemoryAdapter } = await import('@anievo-id/rbac-evolution')
      const engine = createRbac({ adapter: new MemoryAdapter(), teams: true })
      await engine.createPermission('reports.view', { guard: 'api' })
      await engine.for({ type: 'client', id: 7 }, { guard: 'api', team: 1 }).givePermissionTo('reports.view')
      return engine
    })()
    const hook = rbacHandle({ rbac: teams, guard: 'api', getSubject: () => ({ type: 'client', id: 7 }), team: async () => 1 })
    const event = await handled(7, '/', hook)
    expect(getRbac(event)?.guardName).toBe('api')
    expect(await getRbac(event)?.can('reports.view')).toBe(true)
  })

  it('getRbac / the guards throw RbacHandleMissingError without the hook', async () => {
    const event = fakeEvent(1)
    expect(() => getRbac(event)).toThrow(RbacHandleMissingError)
    const error = await thrown(requirePermission(event, 'edit articles'))
    expect(error).toBeInstanceOf(RbacHandleMissingError)
    expect(error).toMatchObject({ code: 'RBAC_HANDLE_MISSING' })
  })
})

describe('getSnapshot', () => {
  it('returns the roles & permissions, or null for guests', async () => {
    expect(await getSnapshot(await handled(1))).toEqual({ roles: ['writer'], permissions: ['edit articles'] })
    expect(await getSnapshot(await handled())).toBeNull()
  })

  it('adds `denied` with checkBefore, also for super-admins', async () => {
    const snapshot = await getSnapshot(await handled(4), { checkBefore: ['billing.manage', 'edit articles'] })
    expect(snapshot).toEqual({ roles: ['super-admin'], permissions: [], denied: ['billing.manage'] })
  })

  it('takes a guard', async () => {
    expect(await getSnapshot(await handled(10), { guard: 'api' })).toEqual({ roles: ['admin'], permissions: ['edit articles'] })
  })
})

describe('default guards', () => {
  it('pass and return the subject', async () => {
    const event = await handled(2)
    const subject = await requirePermission(event, 'edit articles', 'publish articles')
    expect(subject).toBe(getRbac(event))
    await expect(requireRole(event, 'admin|editor')).resolves.toBe(subject)
    await expect(requireRoleOrPermission(event, 'admin|publish articles')).resolves.toBe(subject)
    await expect(canAny(event, 'delete articles', 'publish articles')).resolves.toBe(subject)
    await expect(canAll(event, ['edit articles', 'publish articles'])).resolves.toBe(subject)
  })

  it('throw error(401) with the Express body for guests', async () => {
    const error = await thrown(requirePermission(await handled(), 'edit articles'))
    expect(isHttpError(error, 401)).toBe(true)
    expect(error).toMatchObject({ status: 401, body: { error: 'UNAUTHENTICATED', message: 'User is not logged in.' } })
  })

  it('throw error(403) with the Express body, per kind', async () => {
    const event = await handled(1)
    expect(await thrown(requirePermission(event, 'delete articles'))).toMatchObject({
      status: 403,
      body: { error: 'FORBIDDEN', reason: 'permission', message: 'User does not have the right permissions.' },
    })
    expect(await thrown(requireRole(event, 'admin'))).toMatchObject({
      status: 403,
      body: { error: 'FORBIDDEN', reason: 'role', message: 'User does not have the right roles.' },
    })
    const body = ((await thrown(requireRoleOrPermission(event, 'admin|delete articles'))) as { body: object }).body
    // SvelteKit 3 adds `status` to every error body; nothing else is added.
    const { status: _status, ...rest } = body as { status?: number }
    expect(rest).toEqual({ error: 'FORBIDDEN', reason: 'role_or_permission', message: 'User does not have any of the necessary access rights.' })
    expect('required' in body).toBe(false)
  })

  it('follow the spatie semantics: all permissions, any role, { any } and { all }', async () => {
    const writer = await handled(1)
    expect(await thrown(requirePermission(writer, 'edit articles', 'publish articles'))).toMatchObject({ status: 403 })
    await requirePermission(writer, 'edit articles', 'publish articles', { any: true })
    await requirePermission(writer, 'publish articles|edit articles')
    await requireRole(writer, 'admin', 'writer')
    const both = await handled(2)
    await requireRole(both, 'writer', 'editor', { all: true })
    expect(await thrown(requireRole(writer, 'writer', 'editor', { all: true }))).toMatchObject({ status: 403 })
    expect(await thrown(canAll(writer, 'edit articles', 'publish articles'))).toMatchObject({ status: 403 })
    await canAll(writer, 'edit articles', 'publish articles|edit articles')
  })

  it('let super-admins through permission checks, but not past a `before` denial', async () => {
    const event = await handled(4)
    await requirePermission(event, 'delete articles')
    expect(await thrown(requirePermission(event, 'billing.manage'))).toMatchObject({ status: 403 })
  })

  it('reject a call without names', async () => {
    const event = await handled(1)
    // @ts-expect-error -- at least one name is required
    await expect(requirePermission(event)).rejects.toThrow(TypeError)
    await expect(requireRole(event, '|')).rejects.toThrow(TypeError)
  })

  it('check in another guard with { guard }, like role:admin,api', async () => {
    const event = await handled(10)
    expect(await thrown(requireRole(event, 'admin'))).toMatchObject({ status: 403 })
    const api = await requireRole(event, 'admin', { guard: 'api' })
    expect(api.guardName).toBe('api')
    await requirePermission(event, 'edit articles', { guard: 'api' })
    await requireRoleOrPermission(event, 'editor|edit articles', { guard: 'api' })
    await canAny(event, 'edit articles', 'publish articles', { guard: 'api' })
    await canAll(event, 'edit articles', { guard: 'api' })
    // The request's subject keeps its guard.
    expect(getRbac(event)?.guardName).toBe('web')
    expect(await thrown(requireRole(await handled(), 'admin', { guard: 'api' }))).toMatchObject({ status: 401 })
  })
})

describe('createGuards', () => {
  it('exposes the requirements with exposeRequirements', async () => {
    const guards = createGuards({ exposeRequirements: true })
    const event = await handled(1)
    expect(await thrown(guards.requirePermission(event, 'edit articles', 'delete articles|publish articles'))).toMatchObject({
      status: 403,
      body: { reason: 'permission', required: [['edit articles'], ['delete articles', 'publish articles']] },
    })
    // A guard's own option wins over the default.
    const body = ((await thrown(guards.requireRole(event, 'admin', { exposeRequirements: false }))) as { body: object }).body
    expect('required' in body).toBe(false)
  })

  it('redirects with unauthenticatedRedirect / forbiddenRedirect', async () => {
    const guards = createGuards({ unauthenticatedRedirect: '/login', forbiddenRedirect: '/403' })
    const guest = await thrown(guards.requirePermission(await handled(), 'edit articles'))
    expect(isRedirect(guest)).toBe(true)
    expect(guest).toMatchObject({ status: 303, location: '/login' })
    expect(await thrown(guards.requireRole(await handled(1), 'admin'))).toMatchObject({ status: 303, location: '/403' })
    // Per guard.
    expect(await thrown(requireRole(await handled(1), 'admin', { forbiddenRedirect: '/' }))).toMatchObject({ status: 303, location: '/' })
  })

  it('calls onUnauthenticated / onForbidden with the event and the failed requirement', async () => {
    const { redirect, error } = await import('@sveltejs/kit')
    const onUnauthenticated = vi.fn((event: RequestEvent) => redirect(307, `/login?redirectTo=${event.url.pathname}`))
    const onForbidden = vi.fn(() => error(404, 'Not found'))
    const guards = createGuards({ onUnauthenticated, onForbidden, forbiddenRedirect: '/ignored' })

    expect(await thrown(guards.requireRole(await handled(undefined, '/admin/users'), 'admin'))).toMatchObject({
      status: 307,
      location: '/login?redirectTo=/admin/users',
    })
    expect(onUnauthenticated).toHaveBeenCalledWith(expect.anything(), { kind: 'role', requirements: [['admin']] })
    expect(await thrown(guards.requirePermission(await handled(1), 'delete articles'))).toMatchObject({ status: 404 })
    expect(onForbidden).toHaveBeenCalledWith(expect.anything(), { kind: 'permission', requirements: [['delete articles']] })
  })

  it('lets a guard’s own redirect win over the default handler', async () => {
    const onForbidden = vi.fn(() => {
      throw new Error('not called')
    }) as unknown as () => never
    const guards = createGuards({ onForbidden })
    expect(await thrown(guards.requireRole(await handled(1), 'admin', { forbiddenRedirect: '/nope' }))).toMatchObject({
      status: 303,
      location: '/nope',
    })
  })

  it('falls back to the error when a handler returns instead of throwing', async () => {
    const guards = createGuards({ onUnauthenticated: (() => undefined) as unknown as () => never, onForbidden: (() => undefined) as unknown as () => never })
    expect(await thrown(guards.requireRole(await handled(), 'admin'))).toMatchObject({ status: 401 })
    expect(await thrown(guards.requireRole(await handled(1), 'admin'))).toMatchObject({ status: 403 })
  })
})
