import type { Server } from 'node:http'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Rbac } from '@anievo-id/rbac-evolution'
import { createApp, eventHandler, getRequestHeader, type H3Event, toNodeListener } from 'h3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRbacServer, RbacHttpError } from '../src/server'
import { seededRbac } from './fixtures'

const fakeEvent = (user?: number) => ({ context: {} as Record<string, unknown>, user })

describe('createRbacServer', () => {
  let rbac: Rbac

  beforeAll(async () => {
    rbac = await seededRbac()
  })

  const helpers = () =>
    createRbacServer<ReturnType<typeof fakeEvent>>({
      rbac,
      getSubject: (event) => (event.user === undefined ? null : { type: 'user', id: event.user }),
    })

  it('resolves once per request and stores the subject on event.context.rbac', async () => {
    let calls = 0
    const server = createRbacServer<ReturnType<typeof fakeEvent>>({
      rbac,
      getSubject: (event) => {
        calls++
        return event.user === undefined ? null : { type: 'user', id: event.user }
      },
    })
    const event = fakeEvent(1)
    const first = await server.resolve(event)
    expect(await server.resolve(event)).toBe(first)
    expect(event.context['rbac']).toBe(first)
    expect(calls).toBe(1)

    const guest = fakeEvent()
    expect(await server.resolve(guest)).toBeNull()
    expect(guest.context['rbac']).toBeNull()
    expect(await server.resolve(guest)).toBeNull()
    expect(calls).toBe(2)
  })

  it('returns snapshots', async () => {
    expect(await helpers().snapshot(fakeEvent(1))).toEqual({ roles: ['writer'], permissions: ['edit articles'] })
    expect(await helpers().snapshot(fakeEvent())).toBeNull()
  })

  it('throws 401 for guests with the Express body', async () => {
    const error = await helpers()
      .requirePermission(fakeEvent(), 'edit articles')
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RbacHttpError)
    expect(error).toMatchObject({
      statusCode: 401,
      data: { error: 'UNAUTHENTICATED', message: 'User is not logged in.' },
    })
  })

  it('applies Express semantics to permissions, roles and role-or-permission', async () => {
    const s = helpers()
    const status = (p: Promise<unknown>) =>
      p.then(
        () => 200,
        (e: RbacHttpError) => e.statusCode,
      )

    expect(await status(s.requirePermission(fakeEvent(1), 'edit articles'))).toBe(200)
    expect(await status(s.requirePermission(fakeEvent(1), 'edit articles', 'publish articles'))).toBe(403)
    expect(await status(s.requirePermission(fakeEvent(2), 'edit articles', 'publish articles'))).toBe(200)
    expect(await status(s.requirePermission(fakeEvent(1), 'publish articles|delete articles'))).toBe(403)
    expect(await status(s.requirePermission(fakeEvent(3), 'publish articles|delete articles'))).toBe(200)
    expect(await status(s.requirePermission(fakeEvent(3), 'edit articles', 'delete articles', { any: true }))).toBe(200)

    expect(await status(s.requireRole(fakeEvent(1), 'admin|editor'))).toBe(403)
    expect(await status(s.requireRole(fakeEvent(2), ['admin', 'editor']))).toBe(200)
    expect(await status(s.requireRole(fakeEvent(1), 'writer', 'editor', { all: true }))).toBe(403)
    expect(await status(s.requireRole(fakeEvent(2), 'writer', 'editor', { all: true }))).toBe(200)

    expect(await status(s.requireRoleOrPermission(fakeEvent(1), 'admin|publish articles'))).toBe(403)
    expect(await status(s.requireRoleOrPermission(fakeEvent(2), 'admin|publish articles'))).toBe(200)
    expect(await status(s.requireRoleOrPermission(fakeEvent(3), 'admin|publish articles'))).toBe(200)
  })

  it('returns the SubjectRbac on success', async () => {
    const subject = await helpers().requireRole(fakeEvent(3), 'admin')
    expect(await subject.hasRole('admin')).toBe(true)
  })

  it('rejects empty requirements', async () => {
    await expect(helpers().requireRole(fakeEvent(1), ' | ')).rejects.toThrow(TypeError)
    // @ts-expect-error -- no names is also a type error; at runtime it rejects
    await expect(helpers().requirePermission(fakeEvent(1))).rejects.toThrow(TypeError)
  })

  it('exposes requirements when configured', async () => {
    const s = createRbacServer<ReturnType<typeof fakeEvent>>({
      rbac,
      getSubject: (event) => (event.user === undefined ? null : { type: 'user', id: event.user }),
      exposeRequirements: true,
    })
    await expect(s.requirePermission(fakeEvent(1), 'edit articles', 'publish articles')).rejects.toMatchObject({
      statusCode: 403,
      data: {
        error: 'FORBIDDEN',
        reason: 'permission',
        message: 'User does not have the right permissions.',
        required: [['edit articles'], ['publish articles']],
      },
    })
  })
})

describe('createRbacServer with several instances', () => {
  it('each instance resolves its own subject; the first one fills event.context.rbac', async () => {
    const rbac = await seededRbac()
    await rbac.createRole('api-admin', { guard: 'api' })
    await rbac.for({ type: 'user', id: 1 }, { guard: 'api' }).assignRole('api-admin')
    const getSubject = (event: ReturnType<typeof fakeEvent>) => (event.user === undefined ? null : { type: 'user', id: event.user })
    const web = createRbacServer<ReturnType<typeof fakeEvent>>({ rbac, getSubject })
    const api = createRbacServer<ReturnType<typeof fakeEvent>>({ rbac, getSubject, guard: 'api' })
    const event = fakeEvent(1)

    const webSubject = await web.resolve(event)
    const apiSubject = await api.resolve(event)
    expect(apiSubject?.guardName).toBe('api')
    expect(webSubject?.guardName).not.toBe('api')
    expect(event.context['rbac']).toBe(webSubject)
    await expect(api.requireRole(event, 'api-admin')).resolves.toBe(apiSubject)
    await expect(web.requireRole(event, 'writer')).resolves.toBe(webSubject)
  })
})

describe('createRbacServer canAny / canAll (spatie v8.5)', () => {
  it('canAny needs one of the permissions, canAll every entry', async () => {
    const s = createRbacServer<ReturnType<typeof fakeEvent>>({
      rbac: await seededRbac(),
      getSubject: (event) => (event.user === undefined ? null : { type: 'user', id: event.user }),
    })
    // user 1: edit; user 2: edit + publish
    await expect(s.canAny(fakeEvent(1), 'publish articles', 'edit articles')).resolves.toBeTruthy()
    await expect(s.canAny(fakeEvent(), 'edit articles')).rejects.toMatchObject({ statusCode: 401 })
    await expect(s.canAll(fakeEvent(1), 'edit articles', 'publish articles')).rejects.toMatchObject({ statusCode: 403 })
    await expect(s.canAll(fakeEvent(2), 'edit articles', 'publish articles')).resolves.toBeTruthy()
    await expect(s.canAll(fakeEvent(1), ['edit articles', 'publish articles|edit articles'])).resolves.toBeTruthy()
  })
})

describe('createRbacServer with h3', () => {
  let server: Server
  let url: string

  beforeAll(async () => {
    const rbac = await seededRbac()
    const rbacServer = createRbacServer<H3Event>({
      rbac,
      getSubject: (event) => {
        const id = getRequestHeader(event, 'x-user')
        return id ? { type: 'user', id: Number(id) } : null
      },
    })

    const app = createApp()
    app.use(eventHandler((event) => rbacServer.resolve(event).then(() => undefined)))
    app.use(
      '/publish',
      eventHandler(async (event) => {
        await rbacServer.requirePermission(event, 'publish articles')
        return { ok: true, sameSubject: event.context['rbac'] === (await rbacServer.resolve(event)) }
      }),
    )

    server = createServer(toNodeListener(app))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => {
    server.close()
  })

  const get = async (user?: number) => {
    const res = await fetch(`${url}/publish`, { headers: user === undefined ? {} : { 'x-user': String(user) } })
    return { status: res.status, body: (await res.json()) as Record<string, unknown> }
  }

  it('maps RbacHttpError to an h3 error response', async () => {
    const guest = await get()
    expect(guest.status).toBe(401)
    expect(guest.body['data']).toEqual({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' })

    const writer = await get(1)
    expect(writer.status).toBe(403)
    expect(writer.body['statusMessage']).toBe('Forbidden')
    expect(writer.body['data']).toEqual({
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
    })

    expect(await get(2)).toEqual({ status: 200, body: { ok: true, sameSubject: true } })
  })
})
