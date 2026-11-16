import { type APIRequestContext, expect, test } from '@playwright/test'

// Demo users (examples/nestjs-kysely/src/seed.ts): 1 admin, 2 editor, 3 viewer, 4 nobody.
// API only: the example has no UI. Specs run in order (workers: 1) and change data, so each test restores what it changes.
const as = (request: APIRequestContext, userId: number) => {
  const headers = { cookie: `demo_user=${userId}` }
  return {
    get: (path: string) => request.get(path, { headers }),
    post: (path: string, data?: unknown) => request.post(path, { headers, data }),
    put: (path: string, data: unknown) => request.put(path, { headers, data }),
    delete: (path: string) => request.delete(path, { headers }),
  }
}

test.describe('NestJS guard (RbacModule + decorators) on Kysely', () => {
  test('public routes stay public with the global guard', async ({ request }) => {
    const res = await request.get('/api/users')
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 1, roles: ['admin'] }), expect.objectContaining({ id: 4, roles: [] })]),
    )
    expect(await (await request.get('/api/me')).json()).toEqual({ user: null, snapshot: null })
  })

  test('guest gets 401 UNAUTHENTICATED', async ({ request }) => {
    const res = await request.get('/api/articles')
    expect(res.status()).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'UNAUTHENTICATED' })
  })

  test('user without the permission gets 403 FORBIDDEN (permission)', async ({ request }) => {
    const res = await as(request, 4).get('/api/articles')
    expect(res.status()).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'FORBIDDEN', reason: 'permission' })
  })

  test('@CurrentRbac(): viewers see published articles only, editors see drafts too', async ({ request }) => {
    const viewer = (await (await as(request, 3).get('/api/articles')).json()) as { published: boolean }[]
    const editor = (await (await as(request, 2).get('/api/articles')).json()) as { published: boolean }[]
    expect(viewer.length).toBeGreaterThan(0)
    expect(viewer.every((a) => a.published)).toBe(true)
    expect(editor.some((a) => !a.published)).toBe(true)
  })

  test('the snapshot of /api/me lists the role and permissions', async ({ request }) => {
    expect(await (await as(request, 3).get('/api/me')).json()).toMatchObject({
      user: { id: 3 },
      snapshot: { roles: ['viewer'], permissions: ['view articles'] },
    })
  })

  test('viewer can read but not create', async ({ request }) => {
    expect((await as(request, 3).get('/api/articles')).status()).toBe(200)
    const res = await as(request, 3).post('/api/articles', { title: 'Nope' })
    expect(res.status()).toBe(403)
  })

  test('@RequireRoleOrPermission: editor (permission) and admin (role) publish, viewer cannot', async ({ request }) => {
    const created = await as(request, 2).post('/api/articles', { title: 'From E2E (NestJS)' })
    expect(created.status()).toBe(201)
    const { id } = (await created.json()) as { id: number }

    const denied = await as(request, 3).post(`/api/articles/${id}/publish`)
    expect(denied.status()).toBe(403)
    expect(await denied.json()).toMatchObject({ reason: 'role_or_permission' })
    expect((await as(request, 2).post(`/api/articles/${id}/publish`)).status()).toBe(200)
    expect((await as(request, 1).post(`/api/articles/${id}/publish`)).status()).toBe(200)

    // Only admin has `delete articles`.
    expect((await as(request, 2).delete(`/api/articles/${id}`)).status()).toBe(403)
    expect((await as(request, 1).delete(`/api/articles/${id}`)).status()).toBe(200)
  })

  test('@RequireRoles on the controller: editor gets 403 (role), admin gets in', async ({ request }) => {
    const res = await as(request, 2).get('/api/admin/users')
    expect(res.status()).toBe(403)
    expect(await res.json()).toMatchObject({ reason: 'role' })
    expect((await as(request, 1).get('/api/admin/users')).status()).toBe(200)
  })

  test('a revoked role is denied on the very next request', async ({ request }) => {
    expect((await as(request, 3).get('/api/articles')).status()).toBe(200)
    expect((await as(request, 1).put('/api/admin/users/3/role', { role: null })).status()).toBe(200)
    expect((await as(request, 3).get('/api/articles')).status()).toBe(403)
    // restore
    expect((await as(request, 1).put('/api/admin/users/3/role', { role: 'viewer' })).status()).toBe(200)
    expect((await as(request, 3).get('/api/articles')).status()).toBe(200)
  })

  test('log in sets the session cookie, log out clears it', async ({ request }) => {
    expect((await request.post('/api/login', { data: { userId: 99 } })).status()).toBe(422)
    expect((await request.post('/api/login', { data: { userId: 2 } })).status()).toBe(200)
    expect(await (await request.get('/api/me')).json()).toMatchObject({ user: { id: 2 }, snapshot: { roles: ['editor'] } })
    expect((await request.post('/api/logout')).status()).toBe(204)
    expect((await request.get('/api/articles')).status()).toBe(401)
  })
})
