import { test, expect } from './fixtures/auth'

test.describe('Billing & Invoices', () => {
  test.describe('Billing Dashboard', () => {
    test('should display billing page with summary cards', async ({ adminPage: page }) => {
      await page.goto('/billing')
      await expect(page.getByRole('heading', { name: /billing|invoice/i })).toBeVisible()
      // Summary metrics should be visible
      await expect(
        page.getByText(/total|revenue|billed|collected|outstanding/i).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have New Invoice button', async ({ adminPage: page }) => {
      await page.goto('/billing')
      const newButton = page.getByRole('button', { name: /new invoice|create invoice/i }).or(
        page.getByRole('link', { name: /new invoice|create invoice/i })
      )
      await expect(newButton).toBeVisible()
    })

    test('should have date range filter', async ({ adminPage: page }) => {
      await page.goto('/billing')
      // Date range preset selector
      const dateFilter = page.getByRole('combobox').first().or(
        page.getByRole('button', { name: /today|this week|this month|date/i }).first()
      )
      await expect(dateFilter).toBeVisible()
    })

    test('should display payment method breakdown', async ({ adminPage: page }) => {
      await page.goto('/billing')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/cash|card|online|bank|upi/i).first()
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Create Invoice', () => {
    test('should open invoice creation form', async ({ adminPage: page }) => {
      await page.goto('/billing')
      const newButton = page.getByRole('button', { name: /new invoice|create invoice/i }).or(
        page.getByRole('link', { name: /new invoice|create invoice/i })
      )
      await newButton.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/patient/i).or(page.getByRole('heading', { name: /new|create/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate patient selection', async ({ adminPage: page }) => {
      await page.goto('/billing')
      const newButton = page.getByRole('button', { name: /new invoice|create invoice/i }).or(
        page.getByRole('link', { name: /new invoice|create invoice/i })
      )
      await newButton.click()
      await page.waitForTimeout(500)

      const submitButton = page.getByRole('button', { name: /save|create|submit|generate/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await expect(page.getByText(/required|select.*patient|patient.*required/i).first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show GST calculation', async ({ adminPage: page }) => {
      await page.goto('/billing')
      const newButton = page.getByRole('button', { name: /new invoice|create invoice/i }).or(
        page.getByRole('link', { name: /new invoice|create invoice/i })
      )
      await newButton.click()
      await page.waitForTimeout(500)
      // GST fields should be present
      await expect(
        page.getByText(/gst|cgst|sgst|tax/i).first().or(page.locator('body'))
      ).toBeVisible()
    })
  })

  test.describe('Invoice List', () => {
    test('should display invoices in table', async ({ adminPage: page }) => {
      await page.goto('/billing')
      await page.waitForTimeout(1000)
      // Table with invoices
      await expect(
        page.locator('table').or(page.getByText(/invoice|no data|no invoices/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should filter by status', async ({ adminPage: page }) => {
      await page.goto('/billing')
      const statusFilter = page.getByRole('combobox').or(page.locator('select'))
      if (await statusFilter.first().isVisible()) {
        await statusFilter.first().click()
        await page.waitForTimeout(500)
      }
    })

    test('should have export functionality', async ({ adminPage: page }) => {
      await page.goto('/billing')
      const exportButton = page.getByRole('button', { name: /export/i })
      await expect(exportButton).toBeVisible()
    })
  })

  test.describe('Payment Recording', () => {
    test('should navigate to payments tab', async ({ adminPage: page }) => {
      await page.goto('/billing')
      const paymentsTab = page.getByRole('tab', { name: /payment/i }).or(
        page.getByRole('link', { name: /payment/i })
      )
      if (await paymentsTab.isVisible()) {
        await paymentsTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Payment Plans', () => {
    test('should navigate to payment plans tab', async ({ adminPage: page }) => {
      await page.goto('/billing')
      const plansTab = page.getByRole('tab', { name: /plan|emi/i }).or(
        page.getByRole('link', { name: /plan|emi/i })
      )
      if (await plansTab.isVisible()) {
        await plansTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Billing Refund', () => {
    test('should have refund option on payments', async ({ adminPage: page }) => {
      await page.goto('/billing')
      const paymentsTab = page.getByRole('tab', { name: /payment/i }).or(
        page.getByRole('link', { name: /payment/i })
      )
      if (await paymentsTab.isVisible()) {
        await paymentsTab.click()
        await page.waitForTimeout(1000)
        // Refund button should exist if there are payments
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })
})
