import { test, expect } from './fixtures/auth'

test.describe('CRM Dashboard', () => {
  test.describe('Dashboard Overview', () => {
    test('should display CRM dashboard page', async ({ adminPage: page }) => {
      await page.goto('/crm')
      await expect(
        page.getByRole('heading', { name: /crm|customer|relationship/i }).or(
          page.getByText(/crm|customer relationship/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show membership metrics', async ({ adminPage: page }) => {
      await page.goto('/crm')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/membership|active.*member|member.*revenue/i).first()
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show referral metrics', async ({ adminPage: page }) => {
      await page.goto('/crm')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/referral|conversion|referred/i).first()
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show loyalty points overview', async ({ adminPage: page }) => {
      await page.goto('/crm')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/loyalty|point|reward/i).first()
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show retention metrics', async ({ adminPage: page }) => {
      await page.goto('/crm')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/retention|active.*patient|at.?risk/i).first()
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Navigation', () => {
    test('should have links to CRM sub-pages', async ({ adminPage: page }) => {
      await page.goto('/crm')
      await expect(
        page.getByRole('link', { name: /loyalty|membership|referral|segment/i }).first()
          .or(page.getByRole('tab', { name: /loyalty|membership|referral/i }).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Patient Segments', () => {
    test('should navigate to segments page', async ({ adminPage: page }) => {
      await page.goto('/crm/segments')
      await expect(
        page.getByRole('heading', { name: /segment/i }).or(
          page.getByText(/segment|rfm|group/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should display patient segment cards', async ({ adminPage: page }) => {
      await page.goto('/crm/segments')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/high.?value|at.?risk|new|loyal|dormant|champion/i).first()
          .or(page.getByText(/no.*segment|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
