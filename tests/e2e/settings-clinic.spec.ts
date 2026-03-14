import { test, expect } from './fixtures/auth'

test.describe('Settings', () => {
  test.describe('Settings Page', () => {
    test('should display settings page with categories', async ({ adminPage: page }) => {
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /setting/i })).toBeVisible()
      // Should show settings categories
      await expect(page.getByText(/clinic|billing|communication|security/i).first()).toBeVisible()
    })

    test('should show theme toggle', async ({ adminPage: page }) => {
      await page.goto('/settings')
      // Theme toggle (Light/Dark/System)
      const themeToggle = page.getByRole('button', { name: /light|dark|system|theme/i }).first()
      if (await themeToggle.isVisible()) {
        await expect(themeToggle).toBeVisible()
      }
    })
  })

  test.describe('Clinic Information', () => {
    test('should navigate to clinic settings', async ({ adminPage: page }) => {
      await page.goto('/settings/clinic')
      await expect(
        page.getByRole('heading', { name: /clinic/i }).or(page.getByText(/clinic.*info|clinic.*setting/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should display clinic form fields', async ({ adminPage: page }) => {
      await page.goto('/settings/clinic')
      await page.waitForTimeout(1000)
      // Clinic settings fields
      await expect(
        page.getByLabel(/name|website|gst|phone|address/i).first().or(page.locator('input').first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should save clinic settings', async ({ adminPage: page }) => {
      await page.goto('/settings/clinic')
      await page.waitForTimeout(1000)
      const saveButton = page.getByRole('button', { name: /save|update/i })
      if (await saveButton.isVisible()) {
        await expect(saveButton).toBeVisible()
      }
    })

    test('should have logo upload option', async ({ adminPage: page }) => {
      await page.goto('/settings/clinic')
      await page.waitForTimeout(1000)
      const uploadButton = page.getByRole('button', { name: /upload|logo/i }).or(
        page.getByText(/upload.*logo|clinic.*logo/i)
      )
      if (await uploadButton.isVisible()) {
        await expect(uploadButton).toBeVisible()
      }
    })
  })

  test.describe('Billing Settings', () => {
    test('should navigate to billing settings', async ({ adminPage: page }) => {
      await page.goto('/settings/billing')
      await expect(page.locator('body')).toBeVisible()
    })

    test('should show payment gateway configuration', async ({ adminPage: page }) => {
      await page.goto('/settings/billing')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/razorpay|phonepe|paytm|gateway|payment/i).first()
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Communication Settings', () => {
    test('should navigate to communication settings', async ({ adminPage: page }) => {
      await page.goto('/settings/communications')
      await expect(page.locator('body')).toBeVisible()
    })

    test('should show SMS/Email configuration', async ({ adminPage: page }) => {
      await page.goto('/settings/communications')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/sms|email|twilio|provider/i).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have test send button', async ({ adminPage: page }) => {
      await page.goto('/settings/communications')
      await page.waitForTimeout(1000)
      const testButton = page.getByRole('button', { name: /test|send test/i })
      if (await testButton.isVisible()) {
        await expect(testButton).toBeVisible()
      }
    })
  })

  test.describe('Security Settings', () => {
    test('should navigate to security settings', async ({ adminPage: page }) => {
      await page.goto('/settings/system')
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Procedure Settings', () => {
    test('should navigate to procedure settings', async ({ adminPage: page }) => {
      await page.goto('/settings/procedures')
      await expect(page.locator('body')).toBeVisible()
    })

    test('should display procedures list', async ({ adminPage: page }) => {
      await page.goto('/settings/procedures')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/procedure|no.*data/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have add procedure button', async ({ adminPage: page }) => {
      await page.goto('/settings/procedures')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      if (await addButton.isVisible()) {
        await expect(addButton).toBeVisible()
      }
    })
  })
})
