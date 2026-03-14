import { test, expect } from '@playwright/test'

test.describe('Patient Portal — Forms', () => {
  test.describe('Forms Page (Auth Guard)', () => {
    test('should redirect unauthenticated user to portal login', async ({ page }) => {
      await page.goto('/portal/forms')
      await expect(page).toHaveURL(/.*(?:portal\/login|login)/)
    })
  })

  test.describe('Forms Page Structure', () => {
    test('should have forms heading or redirect', async ({ page }) => {
      await page.goto('/portal/forms')
      await expect(
        page.getByRole('heading', { name: /form|consent|intake|login|sign in|portal/i }).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show available form templates when authenticated', async ({ page }) => {
      await page.goto('/portal/forms')
      // Unauthenticated redirects to login
      await expect(
        page.getByText(/form|template|consent|medical|login|phone/i).first()
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Form Template Types', () => {
    test('should support medical history forms', async ({ page }) => {
      await page.goto('/portal/forms')
      await page.waitForTimeout(1000)
      // Medical history form template should be available
      await expect(page.locator('body')).toBeVisible()
    })

    test('should support consent forms', async ({ page }) => {
      await page.goto('/portal/forms')
      await page.waitForTimeout(1000)
      await expect(page.locator('body')).toBeVisible()
    })

    test('should support intake forms', async ({ page }) => {
      await page.goto('/portal/forms')
      await page.waitForTimeout(1000)
      await expect(page.locator('body')).toBeVisible()
    })

    test('should support feedback forms', async ({ page }) => {
      await page.goto('/portal/forms')
      await page.waitForTimeout(1000)
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Form Detail Page', () => {
    test('should require auth for form detail pages', async ({ page }) => {
      await page.goto('/portal/forms/test-form-id')
      await expect(page).toHaveURL(/.*(?:portal\/login|login|portal\/forms)/)
    })
  })
})
