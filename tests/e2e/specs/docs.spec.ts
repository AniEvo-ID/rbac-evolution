import { expect, test } from '@playwright/test'

test.describe('Docs site', () => {
  test('home page renders without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('RBAC Evolution')
    await expect(page.locator('.rows .row')).toHaveCount(5)
    expect(errors).toEqual([])
  })

  test('install command can be copied', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('./')
    await page.locator('.home-hero').getByRole('button', { name: 'Copy install command' }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('pnpm add @anievo-id/rbac-evolution')
  })

  test('a docs page renders with sidebar and outline', async ({ page }) => {
    await page.goto('basic-usage/teams')
    await expect(page.getByRole('heading', { level: 1, name: 'Teams' })).toBeVisible()
    await expect(page.locator('.VPSidebar')).toContainText('Quick start')
  })

  test('search finds a page', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'Search' }).click()
    await page.locator('#localsearch-input').fill('super-admin')
    await expect(page.locator('.results li').first()).toBeVisible()
  })

  test('unknown pages show the 404 page', async ({ page }) => {
    const res = await page.goto('this-page-does-not-exist')
    expect(res?.status()).toBe(404)
    await expect(page.getByText('This page wandered off the sect grounds.')).toBeVisible()
  })

  test('test report page renders', async ({ page }) => {
    await page.goto('quality')
    await expect(page.getByRole('heading', { level: 1, name: 'Test report' })).toBeVisible()
  })
})
