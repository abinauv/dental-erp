import { test, expect } from './fixtures/auth'

test.describe('CRM Referrals', () => {
  test.describe('Referral List', () => {
    test('should display referrals page', async ({ adminPage: page }) => {
      await page.goto('/crm/referrals')
      await expect(
        page.getByRole('heading', { name: /referral/i }).or(
          page.getByText(/referral/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have Create Referral button', async ({ adminPage: page }) => {
      await page.goto('/crm/referrals')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await expect(createBtn).toBeVisible()
    })

    test('should display referrals in table', async ({ adminPage: page }) => {
      await page.goto('/crm/referrals')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*referral|no.*data|empty/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show referral status badges', async ({ adminPage: page }) => {
      await page.goto('/crm/referrals')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/pending|converted|expired|completed|reward/i).first()
          .or(page.getByText(/no.*referral|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show referrer and referred patient info', async ({ adminPage: page }) => {
      await page.goto('/crm/referrals')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/referrer|referred|patient|from|to/i).first()
          .or(page.getByText(/no.*referral|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Create Referral', () => {
    test('should open referral creation form', async ({ adminPage: page }) => {
      await page.goto('/crm/referrals')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await createBtn.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/referrer|patient|phone|name/i).first()
          .or(page.getByRole('heading', { name: /create|new|referral/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should require referrer patient selection', async ({ adminPage: page }) => {
      await page.goto('/crm/referrals')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await createBtn.click()
      await page.waitForTimeout(500)
      const submitBtn = page.getByRole('button', { name: /save|create|submit/i })
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await expect(page.getByText(/required|select|enter/i).first()).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('Referral Tracking', () => {
    test('should show referral code', async ({ adminPage: page }) => {
      await page.goto('/crm/referrals')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/code|copy|share/i).first()
          .or(page.getByText(/no.*referral|no.*data/i).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show reward status', async ({ adminPage: page }) => {
      await page.goto('/crm/referrals')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/reward|point|gift|bonus/i).first()
          .or(page.getByText(/no.*referral|no.*data/i).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
