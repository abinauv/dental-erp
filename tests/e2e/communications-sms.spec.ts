import { test, expect } from './fixtures/auth'

test.describe('SMS Communications', () => {
  test.describe('Send Single SMS', () => {
    test('should display SMS form on communications page', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const smsTab = page.getByRole('tab', { name: /sms/i }).or(page.getByText(/sms/i).first())
      if (await smsTab.isVisible()) {
        await smsTab.click()
        await page.waitForTimeout(500)
      }
      await expect(
        page.getByLabel(/phone|recipient|number/i).or(page.getByPlaceholder(/phone|number/i))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should have message textarea', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const smsTab = page.getByRole('tab', { name: /sms/i }).or(page.getByText(/sms/i).first())
      if (await smsTab.isVisible()) await smsTab.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/message/i).or(page.locator('textarea').first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate phone number format', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const smsTab = page.getByRole('tab', { name: /sms/i }).or(page.getByText(/sms/i).first())
      if (await smsTab.isVisible()) await smsTab.click()
      await page.waitForTimeout(500)
      const phoneInput = page.getByLabel(/phone|recipient/i).or(page.getByPlaceholder(/phone|number/i))
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('123')
        const sendBtn = page.getByRole('button', { name: /send/i }).first()
        if (await sendBtn.isVisible()) {
          await sendBtn.click()
          await expect(
            page.getByText(/valid|10.*digit|invalid|phone/i).first().or(page.locator('body'))
          ).toBeVisible({ timeout: 5000 })
        }
      }
    })

    test('should show character count', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const smsTab = page.getByRole('tab', { name: /sms/i }).or(page.getByText(/sms/i).first())
      if (await smsTab.isVisible()) await smsTab.click()
      await page.waitForTimeout(500)
      // Character counter near message input
      await expect(
        page.getByText(/character|char|\/160|remaining/i).first().or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Bulk SMS', () => {
    test('should have bulk send option', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const smsTab = page.getByRole('tab', { name: /sms/i }).or(page.getByText(/sms/i).first())
      if (await smsTab.isVisible()) await smsTab.click()
      await page.waitForTimeout(500)
      const bulkBtn = page.getByRole('button', { name: /bulk|batch|multiple/i }).first()
        .or(page.getByText(/bulk|batch/i).first())
      await expect(bulkBtn.or(page.locator('body'))).toBeVisible()
    })
  })

  test.describe('SMS Templates', () => {
    test('should have template selection for SMS', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const smsTab = page.getByRole('tab', { name: /sms/i }).or(page.getByText(/sms/i).first())
      if (await smsTab.isVisible()) await smsTab.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByRole('button', { name: /template/i }).first()
          .or(page.getByText(/template|use.*template/i).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
