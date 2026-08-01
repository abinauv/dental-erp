import { test, expect } from '@playwright/test'

// Seeded by prisma/seed.ts against invoice INV-E2E-0001 (₹1,180 outstanding).
// Keep the two in sync — app/pay/[token] calls notFound() for an unknown
// token, so a stale value here turns every spec below into a 404 assertion.
const PAYMENT_TOKEN = 'e2e-payment-link-token'

test.describe('Public Payment Page', () => {
  test.describe('Payment Link Page', () => {
    test('should display payment page with token', async ({ page }) => {
      await page.goto(`/pay/${PAYMENT_TOKEN}`)
      await expect(page.getByText('Invoice')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('INV-E2E-0001')).toBeVisible()
    })

    test('should 404 for an unknown token', async ({ page }) => {
      const response = await page.goto('/pay/invalid-token-12345')
      // app/pay/[token]/page.tsx calls notFound() when no link matches.
      expect(response?.status()).toBe(404)
      await expect(page.getByText(/could not be found/i)).toBeVisible({ timeout: 10000 })
    })

    test('should not require authentication', async ({ page }) => {
      await page.goto(`/pay/${PAYMENT_TOKEN}`)
      // Should NOT redirect to the staff login page
      expect(page.url()).not.toMatch(/\/login/)
      await expect(page.getByText('Amount Due')).toBeVisible({ timeout: 10000 })
    })

    test('should show payment amount and details', async ({ page }) => {
      await page.goto(`/pay/${PAYMENT_TOKEN}`)
      await expect(page.getByText('Total Amount')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Amount Due')).toBeVisible()
      // Seeded balance, rendered through formatCurrency.
      await expect(page.getByText(/1,180/).first()).toBeVisible()
    })
  })

  test.describe('Payment Gateway Selection', () => {
    // There is no in-page gateway picker: the page renders a single "Pay ₹X"
    // button and /api/public/payments/checkout decides the provider, which then
    // takes over in a hosted checkout. Left here as a marker in case gateway
    // choice is ever surfaced in our own UI.
    test.fixme('should show payment method options', async ({ page }) => {
      await page.goto(`/pay/${PAYMENT_TOKEN}`)
      await expect(page.getByText(/razorpay|phonepe|paytm|upi|netbanking/i).first()).toBeVisible()
    })

    test('should have Pay Now button', async ({ page }) => {
      await page.goto(`/pay/${PAYMENT_TOKEN}`)
      // Rendered as "Pay ₹1,180.00" once the link is payable.
      await expect(page.getByRole('button', { name: /^Pay / })).toBeVisible({ timeout: 10000 })
    })
  })
})
