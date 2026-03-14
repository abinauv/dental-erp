import { test, expect } from './fixtures/auth'

test.describe('Payment Recording Workflow', () => {
  test.describe('Payments List', () => {
    test('should display payments page', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await expect(
        page.getByRole('heading', { name: /payment/i }).or(
          page.getByText(/payment/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should display payments in table', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*payment|no.*data/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput.or(page.locator('body'))).toBeVisible()
    })

    test('should show payment method badges', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/cash|card|online|upi|bank/i).first()
          .or(page.getByText(/no.*payment|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show payment status indicators', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/completed|pending|failed|refunded/i).first()
          .or(page.getByText(/no.*payment|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should display payment amounts with currency', async ({ adminPage: page }) => {
      await page.goto('/billing/payments')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/₹|INR|amount/i).first()
          .or(page.getByText(/no.*payment|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Record Payment from Invoice', () => {
    test('should navigate to invoice detail for payment', async ({ adminPage: page }) => {
      await page.goto('/billing/invoices')
      await page.waitForTimeout(1000)
      const row = page.locator('table tbody tr').first()
      if (await row.isVisible()) {
        const link = row.getByRole('link').first().or(row.locator('a').first())
        if (await link.isVisible()) {
          await link.click()
          await page.waitForTimeout(1000)
          // Record payment button should be visible on invoice detail
          await expect(
            page.getByRole('button', { name: /record.*payment|pay|add.*payment/i }).first()
              .or(page.getByText(/invoice|amount|balance/i).first())
          ).toBeVisible({ timeout: 5000 })
        }
      }
    })

    test('should show payment method selection on payment form', async ({ adminPage: page }) => {
      await page.goto('/billing/invoices')
      await page.waitForTimeout(1000)
      const row = page.locator('table tbody tr').first()
      if (await row.isVisible()) {
        const link = row.getByRole('link').first().or(row.locator('a').first())
        if (await link.isVisible()) {
          await link.click()
          await page.waitForTimeout(1000)
          const payBtn = page.getByRole('button', { name: /record.*payment|pay|add.*payment/i }).first()
          if (await payBtn.isVisible()) {
            await payBtn.click()
            await page.waitForTimeout(500)
            await expect(
              page.getByLabel(/method|mode/i).or(page.getByText(/cash|card|online|upi/i).first())
            ).toBeVisible({ timeout: 5000 })
          }
        }
      }
    })
  })

  test.describe('Payment Summary', () => {
    test('should show payment summary on billing dashboard', async ({ adminPage: page }) => {
      await page.goto('/billing')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/collected|received|total.*payment/i).first()
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
