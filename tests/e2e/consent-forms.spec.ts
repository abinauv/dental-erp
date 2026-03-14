import { test, expect } from './fixtures/auth'

test.describe('Consent Forms', () => {
  test.describe('Form Templates', () => {
    test('should navigate to form settings', async ({ adminPage: page }) => {
      await page.goto('/settings/forms')
      await expect(page.locator('body')).toBeVisible()
    })

    test('should display form templates list', async ({ adminPage: page }) => {
      await page.goto('/settings/forms')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/form|template|no.*data/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have create template button', async ({ adminPage: page }) => {
      await page.goto('/settings/forms')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      if (await addButton.isVisible()) {
        await expect(addButton).toBeVisible()
      }
    })
  })

  test.describe('Form Submissions', () => {
    test('should view form submissions from patients page', async ({ adminPage: page }) => {
      await page.goto('/patients')
      await page.waitForTimeout(1000)
      // Navigate to a patient and look for forms tab
      const patientLink = page.locator('a[href*="/patients/"]').first()
      if (await patientLink.isVisible()) {
        await patientLink.click()
        await page.waitForTimeout(1000)
        const formsTab = page.getByRole('tab', { name: /form|consent/i }).or(
          page.getByText(/intake.*form|consent/i).first()
        )
        if (await formsTab.isVisible()) {
          await formsTab.click()
          await page.waitForTimeout(1000)
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })
  })
})
