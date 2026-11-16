import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import type { Subject } from '@anievo-id/rbac-evolution'

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`)
  }
}
class NotFoundSignal extends Error {
  constructor() {
    super('NEXT_NOT_FOUND')
  }
}

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectSignal(url)
  }),
  notFound: vi.fn(() => {
    throw new NotFoundSignal()
  }),
}))

const { createNextRbac, RbacUnauthorizedError } = await import('../src')

const alice: Subject = { type: 'user', id: 1 } // writer
const bob: Subject = { type: 'user', id: 2 } // admin

async function setup() {
  const rbac = createRbac({ adapter: new MemoryAdapter() })
  await rbac.createPermission('articles.edit')
  await rbac.createPermission('articles.delete')
  await rbac.createPermission('articles.edit', { guard: 'api' })
  await rbac.createRole('writer')
  await rbac.createRole('admin')
  await rbac.role('writer').givePermissionTo('articles.edit')
  await rbac.role('admin').givePermissionTo('articles.edit', 'articles.delete')
  await rbac.for(alice).assignRole('writer')
  await rbac.for(bob).assignRole('admin')
  return rbac
}

let current: Subject | null = null

beforeEach(() => {
  current = null
})

describe('createNextRbac', () => {
  it('getSnapshot returns the subject snapshot, or an empty one for guests', async () => {
    const nextRbac = createNextRbac({ rbac: await setup(), getSubject: () => current })
    expect(await nextRbac.getSnapshot()).toEqual({ roles: [], permissions: [] })
    current = alice
    expect(await nextRbac.getSnapshot()).toEqual({ roles: ['writer'], permissions: ['articles.edit'] })
  })

  it('can / hasRole', async () => {
    const nextRbac = createNextRbac({ rbac: await setup(), getSubject: async () => current })
    expect(await nextRbac.can('articles.edit')).toBe(false)
    current = alice
    expect(await nextRbac.can('articles.edit')).toBe(true)
    expect(await nextRbac.can('articles.delete')).toBe(false)
    expect(await nextRbac.can('unknown')).toBe(false)
    expect(await nextRbac.canAny(['articles.delete', 'articles.edit'])).toBe(true)
    expect(await nextRbac.canAll(['articles.delete', 'articles.edit'])).toBe(false)
    expect(await nextRbac.hasRole('writer')).toBe(true)
    expect(await nextRbac.hasRole(['admin', 'writer'])).toBe(true)
    expect(await nextRbac.hasAllRoles(['admin', 'writer'])).toBe(false)
  })

  it('passes guard through to rbac.for', async () => {
    const rbac = await setup()
    await rbac.createRole('bot', { guard: 'api' })
    await rbac.role('bot', { guard: 'api' }).givePermissionTo('articles.edit')
    await rbac.for({ type: 'client', id: 9 }, { guard: 'api' }).assignRole('bot')
    current = { type: 'client', id: 9 }

    const web = createNextRbac({ rbac, getSubject: () => current })
    expect(await web.hasRole('bot')).toBe(false)
    expect(await web.hasRole('bot', { guard: 'api' })).toBe(true)

    const api = createNextRbac({ rbac, getSubject: () => current, guard: 'api' })
    expect(await api.can('articles.edit')).toBe(true)
  })

  it('passes team (value or function) through to rbac.for', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await rbac.createPermission('billing.view')
    await rbac.createRole('owner', { team: 'acme' })
    await rbac.role('owner', { team: 'acme' }).givePermissionTo('billing.view')
    await rbac.for(alice, { team: 'acme' }).assignRole('owner')
    current = alice

    let tenant: string = 'acme'
    const nextRbac = createNextRbac({ rbac, getSubject: () => current, team: () => tenant })
    expect(await nextRbac.can('billing.view')).toBe(true)
    tenant = 'other'
    expect(await nextRbac.can('billing.view')).toBe(false)
    expect(await nextRbac.can('billing.view', { team: 'acme' })).toBe(true)

    const fixed = createNextRbac({ rbac, getSubject: () => current, team: 'acme' })
    expect(await fixed.hasRole('owner')).toBe(true)
  })

  describe('requirePermission / requireRole', () => {
    it('returns the subject when allowed', async () => {
      const nextRbac = createNextRbac({ rbac: await setup(), getSubject: () => current })
      current = alice
      expect(await nextRbac.requirePermission('articles.edit')).toEqual(alice)
      expect(await nextRbac.requirePermission(['articles.delete', 'articles.edit'])).toEqual(alice)
      expect(await nextRbac.requireRole('writer')).toEqual(alice)
      expect(await nextRbac.requireRoleOrPermission(['admin', 'articles.edit'])).toEqual(alice)
    })

    it('guests: notFound() by default, redirect(loginUrl) when configured', async () => {
      const rbac = await setup()
      await expect(createNextRbac({ rbac, getSubject: () => null }).requirePermission('articles.edit')).rejects.toBeInstanceOf(
        NotFoundSignal,
      )
      const withLogin = createNextRbac({ rbac, getSubject: () => null, loginUrl: '/login' })
      await expect(withLogin.requireRole('writer')).rejects.toMatchObject({ url: '/login' })
      await expect(withLogin.requireRole('writer', { loginUrl: '/signin' })).rejects.toMatchObject({ url: '/signin' })
    })

    it('unauthorized: notFound() by default, custom handler when configured', async () => {
      const rbac = await setup()
      current = alice
      const nextRbac = createNextRbac({ rbac, getSubject: () => current, loginUrl: '/login' })
      await expect(nextRbac.requirePermission('articles.delete')).rejects.toBeInstanceOf(NotFoundSignal)
      await expect(nextRbac.requireRole('admin')).rejects.toBeInstanceOf(NotFoundSignal)

      const custom = createNextRbac({
        rbac,
        getSubject: () => current,
        onUnauthorized: () => {
          throw new RedirectSignal('/403')
        },
      })
      await expect(custom.requireRole('admin')).rejects.toMatchObject({ url: '/403' })
    })

    it('throws RbacUnauthorizedError if a custom handler does not throw', async () => {
      const nextRbac = createNextRbac({
        rbac: await setup(),
        getSubject: () => null,
        onUnauthenticated: (() => undefined) as unknown as () => never,
      })
      await expect(nextRbac.requireRole('admin')).rejects.toBeInstanceOf(RbacUnauthorizedError)
    })
  })

  describe('withPermission (server actions)', () => {
    it('runs the action when allowed, throws RbacUnauthorizedError otherwise', async () => {
      const nextRbac = createNextRbac({ rbac: await setup(), getSubject: () => current })
      const action = vi.fn(async (id: number, title: string) => `${id}:${title}`)
      const guarded = nextRbac.withPermission('articles.delete', action)

      await expect(guarded(1, 'x')).rejects.toMatchObject({ reason: 'unauthenticated', status: 401 })
      current = alice
      const error = await guarded(1, 'x').catch((e: unknown) => e)
      expect(error).toBeInstanceOf(RbacUnauthorizedError)
      expect(error).toMatchObject({ reason: 'unauthorized', status: 403 })
      expect(action).not.toHaveBeenCalled()

      current = bob
      expect(await guarded(1, 'x')).toBe('1:x')
      expect(action).toHaveBeenCalledWith(1, 'x')
    })

    it('withRole', async () => {
      const nextRbac = createNextRbac({ rbac: await setup(), getSubject: () => current })
      const guarded = nextRbac.withRole('admin', () => 'ok')
      current = alice
      await expect(guarded()).rejects.toBeInstanceOf(RbacUnauthorizedError)
      current = bob
      expect(await guarded()).toBe('ok')
    })
  })

  describe('withRbac (route handlers)', () => {
    const handler = async (req: Request, ctx: { params: Promise<{ id: string }> }) =>
      Response.json({ id: (await ctx.params).id, method: req.method })
    const ctx = { params: Promise.resolve({ id: '42' }) }

    it('401 for guests, 403 when missing permission, handler otherwise', async () => {
      const nextRbac = createNextRbac({ rbac: await setup(), getSubject: () => current })
      const DELETE = nextRbac.withRbac(handler, { permission: 'articles.delete' })
      const req = () => new Request('http://localhost/api/articles/42', { method: 'DELETE' })

      let res = await DELETE(req(), ctx)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' })

      current = alice
      res = await DELETE(req(), ctx)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({
        error: 'FORBIDDEN',
        reason: 'permission',
        message: 'User does not have the right permissions.',
      })

      current = bob
      res = await DELETE(req(), ctx)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ id: '42', method: 'DELETE' })
    })

    it('role and roleOrPermission', async () => {
      const nextRbac = createNextRbac({ rbac: await setup(), getSubject: () => current })
      current = alice
      const byRole = nextRbac.withRbac(() => new Response('ok'), { role: ['admin'] })
      expect((await byRole()).status).toBe(403)
      const either = nextRbac.withRbac(() => new Response('ok'), { roleOrPermission: ['admin', 'articles.edit'] })
      expect((await either()).status).toBe(200)
      const eitherRole = nextRbac.withRbac(() => new Response('ok'), { roleOrPermission: 'writer' })
      expect((await eitherRole()).status).toBe(200)
    })

    it('guard option', async () => {
      const rbac = await setup()
      await rbac.for({ type: 'client', id: 7 }, { guard: 'api' }).givePermissionTo('articles.edit')
      current = { type: 'client', id: 7 }
      const nextRbac = createNextRbac({ rbac, getSubject: () => current })
      expect((await nextRbac.withRbac(() => new Response('ok'), { permission: 'articles.edit' })()).status).toBe(403)
      expect(
        (await nextRbac.withRbac(() => new Response('ok'), { permission: 'articles.edit', guard: 'api' })()).status,
      ).toBe(200)
    })
  })

  describe('per-call guard option (spatie `role:admin,api`)', () => {
    async function apiAdmin() {
      const rbac = await setup()
      // Client 10 has `admin` and `articles.edit` only in guard `api`.
      await rbac.createRole('admin', { guard: 'api' })
      await rbac.for({ type: 'client', id: 10 }, { guard: 'api' }).assignRole('admin')
      await rbac.for({ type: 'client', id: 10 }, { guard: 'api' }).givePermissionTo('articles.edit')
      return createNextRbac({ rbac, getSubject: () => current })
    }

    it('requireRole / requirePermission / requireRoleOrPermission check in `{ guard }`', async () => {
      const nextRbac = await apiAdmin()
      current = { type: 'client', id: 10 }
      await expect(nextRbac.requireRole('admin', { guard: 'api' })).resolves.toEqual(current)
      await expect(nextRbac.requireRole('admin')).rejects.toBeInstanceOf(NotFoundSignal)
      await expect(nextRbac.requirePermission('articles.edit', { guard: 'api' })).resolves.toEqual(current)
      await expect(nextRbac.requirePermission('articles.edit')).rejects.toBeInstanceOf(NotFoundSignal)
      await expect(nextRbac.requireRoleOrPermission(['admin', 'articles.edit'], { guard: 'api' })).resolves.toEqual(
        current,
      )
      await expect(nextRbac.requireRoleOrPermission(['admin', 'articles.edit'])).rejects.toBeInstanceOf(NotFoundSignal)
    })

    it('a guest is still unauthenticated whatever the guard', async () => {
      const nextRbac = await apiAdmin()
      await expect(nextRbac.requireRole('admin', { guard: 'api', loginUrl: '/login' })).rejects.toMatchObject({
        url: '/login',
      })
    })
  })
})
