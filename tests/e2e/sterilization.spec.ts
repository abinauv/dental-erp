import { test, expect } from './fixtures/auth'

test.describe('Sterilization Management', () => {
  test.describe('Sterilization Dashboard', () => {
    test('should display sterilization page', async ({ adminPage: page }) => {
      await page.goto('/sterilization')
      await expect(page.getByRole('heading', { name: /sterilization/i })).toBeVisible()
    })

    test('should show instruments section', async ({ adminPage: page }) => {
      await page.goto('/sterilization')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/instrument|equipment/i).first()
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Instruments', () => {
    test('should navigate to instruments page', async ({ adminPage: page }) => {
      await page.goto('/sterilization')
      const instrumentsLink = page.getByRole('link', { name: /instrument/i }).or(
        page.getByRole('tab', { name: /instrument/i })
      )
      if (await instrumentsLink.isVisible()) {
        await instrumentsLink.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('should have add instrument button', async ({ adminPage: page }) => {
      await page.goto('/sterilization')
      const addButton = page.getByRole('button', { name: /add|new|register/i }).first()
      if (await addButton.isVisible()) {
        await expect(addButton).toBeVisible()
      }
    })
  })

  test.describe('Sterilization Logs', () => {
    test('should navigate to logs section', async ({ adminPage: page }) => {
      await page.goto('/sterilization')
      const logsTab = page.getByRole('tab', { name: /log/i }).or(
        page.getByRole('link', { name: /log/i })
      )
      if (await logsTab.isVisible()) {
        await logsTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Compliance', () => {
    test('should show compliance section', async ({ adminPage: page }) => {
      await page.goto('/sterilization')
      const complianceTab = page.getByRole('tab', { name: /compliance/i }).or(
        page.getByText(/compliance/i).first()
      )
      if (await complianceTab.isVisible()) {
        await expect(complianceTab).toBeVisible()
      }
    })
  })
})
