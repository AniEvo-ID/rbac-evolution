import { expect, test } from '@playwright/test'

// Demo users (examples/next-prisma/prisma/seed.ts): 1 admin, 2 editor, 3 viewer, 4 nobody.
const BASE = 'http://localhost:3100'
const cookie = (id: number) => ({ headers: { cookie: `demo_user=${id}` } })

test.describe('Route handlers (withRbac)', () => {
  test('guest gets 401, user without permission 403, viewer 200', async ({ request }) => {
    expect((await request.get('/api/articles')).status()).toBe(401)
    expect((await request.get('/api/articles', cookie(4))).status()).toBe(403)
    expect((await request.get('/api/articles', cookie(3))).status()).toBe(200)
  })

  test('editor cannot delete, admin can', async ({ request }) => {
    expect((await request.delete('/api/articles/3', cookie(2))).status()).toBe(403)
    expect((await request.delete('/api/articles/3', cookie(1))).status()).toBe(200)
  })
})

test.describe('Middleware (createRbacMiddleware)', () => {
  test('editor is blocked from /admin, admin gets in', async ({ request }) => {
    expect((await request.get('/admin', { ...cookie(2), maxRedirects: 0 })).status()).toBe(403)
    expect((await request.get('/admin', { ...cookie(1), maxRedirects: 0 })).status()).toBe(200)
  })
})

test.describe('React UI (<Can>) and server actions', () => {
  test('viewer logs in and sees no write form', async ({ page }) => {
    await page.goto('/login')
    await page.locator('form.card', { hasText: 'Vera Viewer' }).getByRole('button', { name: 'Log in' }).click()
    // the login server action sets the cookie, then redirects to /articles
    await page.waitForURL(/\/articles$/)
    await expect(page.getByRole('heading', { name: 'Articles' })).toBeVisible()
    await expect(page.getByText("You can't write articles.")).toBeVisible()
    await expect(page.getByText('New article')).toHaveCount(0)
  })

  test('editor creates an article through a guarded server action', async ({ page, context }) => {
    await context.addCookies([{ name: 'demo_user', value: '2', url: BASE }])
    await page.goto('/articles')
    await expect(page.getByText('New article')).toBeVisible()
    await page.getByPlaceholder('Title').fill('Server action from Playwright')
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Server action from Playwright').first()).toBeVisible()
  })
})
