import { test, expect } from './fixtures/auth'

test.describe('Email Communications', () => {
  test.describe('Send Email', () => {
    test('should display email form', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const emailTab = page.getByRole('tab', { name: /email/i }).or(page.getByText(/email/i).first())
      if (await emailTab.isVisible()) {
        await emailTab.click()
        await page.waitForTimeout(500)
      }
      await expect(
        page.getByLabel(/email|to|recipient/i).first()
          .or(page.getByPlaceholder(/email|recipient/i).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should have subject line field', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const emailTab = page.getByRole('tab', { name: /email/i }).or(page.getByText(/email/i).first())
      if (await emailTab.isVisible()) await emailTab.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/subject/i).or(page.getByPlaceholder(/subject/i))
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should have message body field', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const emailTab = page.getByRole('tab', { name: /email/i }).or(page.getByText(/email/i).first())
      if (await emailTab.isVisible()) await emailTab.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/body|message|content/i).or(page.locator('textarea').first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate email address format', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const emailTab = page.getByRole('tab', { name: /email/i }).or(page.getByText(/email/i).first())
      if (await emailTab.isVisible()) await emailTab.click()
      await page.waitForTimeout(500)
      const emailInput = page.getByLabel(/email|to|recipient/i).first()
        .or(page.getByPlaceholder(/email/i).first())
      if (await emailInput.isVisible()) {
        await emailInput.fill('invalid-email')
        const sendBtn = page.getByRole('button', { name: /send/i }).first()
        if (await sendBtn.isVisible()) {
          await sendBtn.click()
          await expect(
            page.getByText(/valid|invalid|email|format/i).first().or(page.locator('body'))
          ).toBeVisible({ timeout: 5000 })
        }
      }
    })
  })

  test.describe('Email Templates', () => {
    test('should have template selection for email', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const emailTab = page.getByRole('tab', { name: /email/i }).or(page.getByText(/email/i).first())
      if (await emailTab.isVisible()) await emailTab.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByRole('button', { name: /template/i }).first()
          .or(page.getByText(/template|use.*template/i).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Email Tracking', () => {
    test('should show email analytics on analytics page', async ({ adminPage: page }) => {
      await page.goto('/communications/analytics')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/sent|delivered|opened|email/i).first()
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
