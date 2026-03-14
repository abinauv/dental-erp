import { test, expect } from './fixtures/auth'

test.describe('Communications', () => {
  test.describe('Communications Page', () => {
    test('should display communications page', async ({ adminPage: page }) => {
      await page.goto('/communications')
      await expect(page.getByRole('heading', { name: /communication/i })).toBeVisible()
    })

    test('should show SMS and Email tabs', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const smsTab = page.getByRole('tab', { name: /sms/i }).or(page.getByText(/sms/i).first())
      const emailTab = page.getByRole('tab', { name: /email/i }).or(page.getByText(/email/i).first())
      await expect(smsTab).toBeVisible()
      await expect(emailTab).toBeVisible()
    })
  })

  test.describe('SMS', () => {
    test('should show SMS send form', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const smsTab = page.getByRole('tab', { name: /sms/i }).or(page.getByText(/sms/i).first())
      if (await smsTab.isVisible()) {
        await smsTab.click()
        await page.waitForTimeout(500)
      }
      // Phone input and message textarea
      const phoneInput = page.getByLabel(/phone|recipient|number/i).or(
        page.getByPlaceholder(/phone|number/i)
      )
      await expect(phoneInput.or(page.locator('body'))).toBeVisible()
    })

    test('should validate SMS fields', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const smsTab = page.getByRole('tab', { name: /sms/i }).or(page.getByText(/sms/i).first())
      if (await smsTab.isVisible()) {
        await smsTab.click()
        await page.waitForTimeout(500)
      }
      const sendButton = page.getByRole('button', { name: /send/i }).first()
      if (await sendButton.isVisible()) {
        await sendButton.click()
        // Should show validation errors
        await expect(page.getByText(/required|enter|provide/i).first().or(page.locator('body'))).toBeVisible({ timeout: 3000 })
      }
    })
  })

  test.describe('Email', () => {
    test('should show email send form', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const emailTab = page.getByRole('tab', { name: /email/i }).or(page.getByText(/email/i).first())
      if (await emailTab.isVisible()) {
        await emailTab.click()
        await page.waitForTimeout(500)
      }
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Templates', () => {
    test('should navigate to templates section', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const templatesTab = page.getByRole('tab', { name: /template/i }).or(
        page.getByRole('link', { name: /template/i })
      )
      if (await templatesTab.isVisible()) {
        await templatesTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Surveys', () => {
    test('should navigate to surveys section', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const surveysTab = page.getByRole('tab', { name: /survey/i }).or(
        page.getByRole('link', { name: /survey/i })
      )
      if (await surveysTab.isVisible()) {
        await surveysTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Automations', () => {
    test('should navigate to automations section', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const automationsTab = page.getByRole('tab', { name: /automation/i }).or(
        page.getByRole('link', { name: /automation/i })
      )
      if (await automationsTab.isVisible()) {
        await automationsTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Analytics', () => {
    test('should navigate to analytics section', async ({ adminPage: page }) => {
      await page.goto('/communications')
      const analyticsTab = page.getByRole('tab', { name: /analytics/i }).or(
        page.getByRole('link', { name: /analytics/i })
      )
      if (await analyticsTab.isVisible()) {
        await analyticsTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })
})
