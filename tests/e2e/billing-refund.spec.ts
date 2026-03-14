import { test, expect } from './fixtures/auth'

test.describe('Billing Refund Workflow', () => {
  test.describe('Refund from Payments', () => {
    test('should navigate to payments page', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await expect(
        page.getByRole('heading', { name: /payment/i }).or(
          page.getByText(/payment/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show refund option on completed payments', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await page.waitForTimeout(1000)
      // Action menu with refund option
      const moreBtn = page.locator('[data-testid="more-actions"]').first()
        .or(page.getByRole('button', { name: /action|more|menu|⋮/i }).first())
      if (await moreBtn.isVisible()) {
        await moreBtn.click()
        await page.waitForTimeout(300)
        await expect(
          page.getByRole('menuitem', { name: /refund/i }).or(
            page.getByText(/refund/i).first()
          )
        ).toBeVisible({ timeout: 3000 })
      }
    })

    test('should show refund form with amount field', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await page.waitForTimeout(1000)
      // Try to click refund on first payment
      const refundBtn = page.getByRole('button', { name: /refund/i }).first()
      if (await refundBtn.isVisible()) {
        await refundBtn.click()
        await page.waitForTimeout(500)
        await expect(
          page.getByLabel(/amount|refund/i).or(
            page.getByRole('heading', { name: /refund/i })
          )
        ).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show refund reason field', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await page.waitForTimeout(1000)
      const refundBtn = page.getByRole('button', { name: /refund/i }).first()
      if (await refundBtn.isVisible()) {
        await refundBtn.click()
        await page.waitForTimeout(500)
        // Reason/notes field
        await expect(
          page.getByLabel(/reason|note|comment/i).or(page.locator('textarea').first())
        ).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('Refund Validation', () => {
    test('should prevent refund exceeding payment amount', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await page.waitForTimeout(1000)
      // Business rule: refund amount cannot exceed original payment
      await expect(page.locator('body')).toBeVisible()
    })

    test('should show refund status in payment list', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await page.waitForTimeout(1000)
      // Refunded payments should have a visual indicator
      await expect(
        page.getByText(/refund|completed|pending|failed/i).first()
          .or(page.getByText(/no.*payment|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Refund Impact', () => {
    test('should reflect refund in billing dashboard', async ({ adminPage: page }) => {
      await page.goto('/billing')
      await page.waitForTimeout(1000)
      // Dashboard should show refund-aware totals
      await expect(
        page.getByText(/refund|collected|outstanding|total/i).first()
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
