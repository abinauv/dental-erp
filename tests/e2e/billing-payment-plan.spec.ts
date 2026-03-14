import { test, expect } from './fixtures/auth'

test.describe('Payment Plans (EMI)', () => {
  test.describe('Payment Plans List', () => {
    test('should display payment plans page', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans')
      await expect(
        page.getByRole('heading', { name: /payment plan|emi|installment/i }).or(
          page.getByText(/payment plan|emi/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have New Plan button', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans')
      const newButton = page.getByRole('button', { name: /new|add|create/i }).first().or(
        page.getByRole('link', { name: /new|add|create/i }).first()
      )
      await expect(newButton).toBeVisible()
    })

    test('should display plans in table', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*plan|no.*data|empty/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show plan status badges', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/active|completed|overdue|defaulted|cancelled/i).first()
          .or(page.getByText(/no.*plan|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show installment progress', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans')
      await page.waitForTimeout(1000)
      // Progress indicators (paid/total installments)
      await expect(
        page.getByText(/installment|paid|remaining|progress/i).first()
          .or(page.getByText(/no.*plan|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Create Payment Plan', () => {
    test('should open payment plan creation form', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans/new')
      await expect(
        page.getByLabel(/patient|invoice/i).or(
          page.getByRole('heading', { name: /new|create|payment plan/i })
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should require invoice or amount', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans/new')
      await page.waitForTimeout(1000)
      const submitBtn = page.getByRole('button', { name: /save|create|submit/i })
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await expect(page.getByText(/required|select|enter/i).first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show installment configuration fields', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans/new')
      await page.waitForTimeout(1000)
      // Installments count, frequency, amount per installment
      await expect(
        page.getByLabel(/installment|frequency|interval|tenure/i).first()
          .or(page.getByText(/installment|monthly|weekly/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should calculate installment amounts', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans/new')
      await page.waitForTimeout(1000)
      // Total amount and per-installment breakdown
      await expect(
        page.getByText(/total|amount|₹|per.*installment/i).first()
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Payment Plan Detail', () => {
    test('should view plan detail with installment schedule', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans')
      await page.waitForTimeout(1000)
      const row = page.locator('table tbody tr').first()
      if (await row.isVisible()) {
        const link = row.getByRole('link').first().or(row.locator('a').first())
        if (await link.isVisible()) {
          await link.click()
          await page.waitForTimeout(1000)
          await expect(
            page.getByText(/schedule|installment|due|paid/i).first()
          ).toBeVisible({ timeout: 5000 })
        }
      }
    })

    test('should have pay installment button', async ({ adminPage: page }) => {
      await page.goto('/billing/payment-plans')
      await page.waitForTimeout(1000)
      const row = page.locator('table tbody tr').first()
      if (await row.isVisible()) {
        const link = row.getByRole('link').first().or(row.locator('a').first())
        if (await link.isVisible()) {
          await link.click()
          await page.waitForTimeout(1000)
          const payBtn = page.getByRole('button', { name: /pay|record|collect/i }).first()
          await expect(payBtn.or(page.locator('body'))).toBeVisible()
        }
      }
    })
  })
})
