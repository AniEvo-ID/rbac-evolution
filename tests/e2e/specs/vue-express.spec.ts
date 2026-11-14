import { type APIRequestContext, expect, test } from '@playwright/test'

// Demo users (examples/vue-express/server/seed.ts): 1 admin, 2 editor, 3 viewer, 4 nobody.
const as = (request: APIRequestContext, userId: number) => ({
  get: (path: string) => request.get(path, { headers: { cookie: `demo_user=${userId}` } }),
  post: (path: string, data: unknown) => request.post(path, { headers: { cookie: `demo_user=${userId}` }, data }),
  put: (path: string, data: unknown) => request.put(path, { headers: { cookie: `demo_user=${userId}` }, data }),
})

test.describe('API guards (Express)', () => {
  test('guest gets 401 UNAUTHENTICATED', async ({ request }) => {
    const res = await request.get('/api/articles')
    expect(res.status()).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'UNAUTHENTICATED' })
  })

  test('user without the permission gets 403 FORBIDDEN', async ({ request }) => {
    const res = await as(request, 4).get('/api/articles')
    expect(res.status()).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'FORBIDDEN' })
  })

  test('viewer can read but not create', async ({ request }) => {
    expect((await as(request, 3).get('/api/articles')).status()).toBe(200)
    expect((await as(request, 3).post('/api/articles', { title: 'Nope' })).status()).toBe(403)
  })

  test('editor can create but not open admin routes', async ({ request }) => {
    expect((await as(request, 2).post('/api/articles', { title: 'From E2E' })).status()).toBe(201)
    const admin = await as(request, 2).get('/api/admin/users')
    expect(admin.status()).toBe(403)
    expect(await admin.json()).toMatchObject({ reason: 'role' })
  })

  test('a revoked role is denied on the very next request', async ({ request }) => {
    expect((await as(request, 3).get('/api/articles')).status()).toBe(200)
    expect((await as(request, 1).put('/api/admin/users/3/role', { role: null })).status()).toBe(200)
    expect((await as(request, 3).get('/api/articles')).status()).toBe(403)
    // restore for the UI tests
    expect((await as(request, 1).put('/api/admin/users/3/role', { role: 'viewer' })).status()).toBe(200)
    expect((await as(request, 3).get('/api/articles')).status()).toBe(200)
  })
})

test.describe('Vue UI (<Can>, v-can, route guards)', () => {
  test('viewer logs in and sees the read-only page', async ({ page }) => {
    await page.goto('/login')
    await page.locator('.card', { hasText: 'Vera Viewer' }).getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/articles$/)
    await expect(page.getByRole('heading', { name: 'Articles' })).toBeVisible()
    await expect(page.getByText("You can't write articles.")).toBeVisible()
    await expect(page.getByText('New article')).toHaveCount(0)
  })

  test('editor sees the form and creates an article', async ({ page, context }) => {
    await context.addCookies([{ name: 'demo_user', value: '2', url: 'http://localhost:4100' }])
    await page.goto('/articles')
    await expect(page.getByText('New article')).toBeVisible()
    await page.getByPlaceholder('Title').fill('Written by Playwright')
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Written by Playwright').first()).toBeVisible()
  })

  test('editor is sent to 403 when opening /admin', async ({ page, context }) => {
    await context.addCookies([{ name: 'demo_user', value: '2', url: 'http://localhost:4100' }])
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: '403 — Forbidden' })).toBeVisible()
  })

  test('admin opens /admin', async ({ page, context }) => {
    await context.addCookies([{ name: 'demo_user', value: '1', url: 'http://localhost:4100' }])
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
  })
})
