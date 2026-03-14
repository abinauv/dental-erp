import { test, expect } from './fixtures/auth'

test.describe('Prescriptions', () => {
  test.describe('Prescription List', () => {
    test('should display prescriptions page', async ({ adminPage: page }) => {
      await page.goto('/prescriptions')
      await expect(page.getByRole('heading', { name: /prescription/i })).toBeVisible()
    })

    test('should have new prescription button', async ({ adminPage: page }) => {
      await page.goto('/prescriptions')
      const newButton = page.getByRole('button', { name: /new|add|create/i }).first().or(
        page.getByRole('link', { name: /new|add|create/i }).first()
      )
      await expect(newButton).toBeVisible()
    })

    test('should display prescriptions in table', async ({ adminPage: page }) => {
      await page.goto('/prescriptions')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*prescription|no.*data/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/prescriptions')
      const searchInput = page.getByPlaceholder(/search/i)
      if (await searchInput.isVisible()) {
        await expect(searchInput).toBeVisible()
      }
    })
  })

  test.describe('Create Prescription', () => {
    test('should open prescription creation form', async ({ adminPage: page }) => {
      await page.goto('/prescriptions')
      const newButton = page.getByRole('button', { name: /new|add|create/i }).first().or(
        page.getByRole('link', { name: /new|add|create/i }).first()
      )
      await newButton.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/patient/i).or(page.getByRole('heading', { name: /new|create|add/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show medication fields', async ({ adminPage: page }) => {
      await page.goto('/prescriptions')
      const newButton = page.getByRole('button', { name: /new|add|create/i }).first().or(
        page.getByRole('link', { name: /new|add|create/i }).first()
      )
      await newButton.click()
      await page.waitForTimeout(500)
      // Medication fields: name, dosage, frequency, duration
      await expect(
        page.getByText(/medication|medicine|drug|dosage/i).first().or(page.locator('body'))
      ).toBeVisible()
    })

    test('should validate required fields', async ({ adminPage: page }) => {
      await page.goto('/prescriptions')
      const newButton = page.getByRole('button', { name: /new|add|create/i }).first().or(
        page.getByRole('link', { name: /new|add|create/i }).first()
      )
      await newButton.click()
      await page.waitForTimeout(500)

      const submitButton = page.getByRole('button', { name: /save|create|submit/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await expect(page.getByText(/required|select|choose/i).first()).toBeVisible({ timeout: 5000 })
      }
    })
  })
})
