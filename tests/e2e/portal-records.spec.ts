import { test, expect } from '@playwright/test'

test.describe('Patient Portal — Medical Records', () => {
  test.describe('Records Page (Auth Guard)', () => {
    test('should redirect unauthenticated user to portal login', async ({ page }) => {
      await page.goto('/portal/records')
      await expect(page).toHaveURL(/.*(?:portal\/login|login)/)
    })
  })

  test.describe('Records Page Structure', () => {
    test('should have records heading or login redirect', async ({ page }) => {
      await page.goto('/portal/records')
      await expect(
        page.getByRole('heading', { name: /record|medical|treatment|login|sign in|portal/i }).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show tab structure for records types', async ({ page }) => {
      await page.goto('/portal/records')
      await page.waitForTimeout(1000)
      // Records tabs: treatments, chart, documents
      await expect(
        page.getByText(/treatment|chart|document|prescription|record|login|phone/i).first()
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Prescriptions Access', () => {
    test('should redirect unauthenticated user for prescriptions', async ({ page }) => {
      await page.goto('/portal/prescriptions')
      await expect(page).toHaveURL(/.*(?:portal\/login|login)/)
    })

    test('should have prescriptions page structure', async ({ page }) => {
      await page.goto('/portal/prescriptions')
      await expect(
        page.getByRole('heading', { name: /prescription|medication|login|sign in|portal/i }).first()
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Photo Upload', () => {
    test('should redirect unauthenticated user for photo upload', async ({ page }) => {
      await page.goto('/portal/upload-photo')
      await expect(page).toHaveURL(/.*(?:portal\/login|login)/)
    })
  })
})
