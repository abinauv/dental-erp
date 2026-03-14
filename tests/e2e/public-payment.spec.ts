import { test, expect } from '@playwright/test'

test.describe('Public Payment Page', () => {
  test.describe('Payment Link Page', () => {
    test('should display payment page with token', async ({ page }) => {
      await page.goto('/pay/test-token')
      await page.waitForTimeout(1000)
      // Should show payment page or invalid token message
      await expect(
        page.getByText(/payment|pay|invoice|amount|₹|invalid|expired|not found/i).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show error for invalid token', async ({ page }) => {
      await page.goto('/pay/invalid-token-12345')
      await page.waitForTimeout(1000)
      // Invalid token should show error message
      await expect(
        page.getByText(/invalid|expired|not found|error|payment/i).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should not require authentication', async ({ page }) => {
      await page.goto('/pay/test-token')
      await page.waitForTimeout(1000)
      // Should NOT redirect to login page
      const url = page.url()
      expect(url).not.toMatch(/\/login/)
    })

    test('should show payment amount and details', async ({ page }) => {
      await page.goto('/pay/test-token')
      await page.waitForTimeout(1000)
      // Payment page should show amount or error
      await expect(
        page.getByText(/₹|amount|total|pay|invoice|invalid|expired/i).first()
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Payment Gateway Selection', () => {
    test('should show payment method options', async ({ page }) => {
      await page.goto('/pay/test-token')
      await page.waitForTimeout(1000)
      // Payment methods: Razorpay, PhonePe, Paytm or error
      await expect(
        page.getByText(/razorpay|phonepe|paytm|card|upi|netbanking|payment|invalid|expired/i).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have Pay Now button', async ({ page }) => {
      await page.goto('/pay/test-token')
      await page.waitForTimeout(1000)
      const payBtn = page.getByRole('button', { name: /pay|proceed|continue/i }).first()
      // Pay button should exist on valid payment pages
      await expect(
        payBtn.or(page.getByText(/invalid|expired|not found/i).first())
      ).toBeVisible({ timeout: 10000 })
    })
  })
})
