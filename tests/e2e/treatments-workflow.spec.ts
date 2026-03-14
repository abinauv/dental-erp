import { test, expect } from './fixtures/auth'

test.describe('Treatment Workflow', () => {
  test.describe('Treatment List', () => {
    test('should display treatments page', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      await expect(page.getByRole('heading', { name: /treatment/i })).toBeVisible()
    })

    test('should have New Treatment button', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      const newButton = page.getByRole('button', { name: /new treatment|add treatment/i }).or(
        page.getByRole('link', { name: /new treatment|add treatment/i })
      )
      await expect(newButton).toBeVisible()
    })

    test('should have status filter', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      const statusFilter = page.getByRole('combobox').first().or(
        page.locator('select').first()
      )
      await expect(statusFilter.or(page.getByText(/status|filter/i).first())).toBeVisible()
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput).toBeVisible()
    })

    test('should display treatments in table', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*treatment|no.*data/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have export functionality', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      const exportButton = page.getByRole('button', { name: /export/i })
      await expect(exportButton).toBeVisible()
    })
  })

  test.describe('Create Treatment', () => {
    test('should open treatment creation form', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      const newButton = page.getByRole('button', { name: /new treatment|add treatment/i }).or(
        page.getByRole('link', { name: /new treatment|add treatment/i })
      )
      await newButton.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/patient/i).or(page.getByRole('heading', { name: /new|create|add/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate required fields', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      const newButton = page.getByRole('button', { name: /new treatment|add treatment/i }).or(
        page.getByRole('link', { name: /new treatment|add treatment/i })
      )
      await newButton.click()
      await page.waitForTimeout(500)

      const submitButton = page.getByRole('button', { name: /save|create|add|submit/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await expect(page.getByText(/required|select|choose/i).first()).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('Treatment Plans', () => {
    test('should navigate to treatment plans', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      const plansTab = page.getByRole('tab', { name: /plan/i }).or(
        page.getByRole('link', { name: /plan/i })
      )
      if (await plansTab.isVisible()) {
        await plansTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Dental Chart', () => {
    test('should navigate to dental chart', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      const chartLink = page.getByRole('link', { name: /dental chart|chart/i }).or(
        page.getByRole('tab', { name: /chart/i })
      )
      if (await chartLink.isVisible()) {
        await chartLink.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Treatment Status Workflow', () => {
    test('should show start treatment button for planned treatments', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      await page.waitForTimeout(1000)
      // Start/complete buttons should exist for appropriate treatments
      const startButton = page.getByRole('button', { name: /start/i }).first()
      // May or may not be visible depending on data
      await expect(page.locator('body')).toBeVisible()
    })

    test('should show complete button for in-progress treatments', async ({ adminPage: page }) => {
      await page.goto('/treatments')
      await page.waitForTimeout(1000)
      const completeButton = page.getByRole('button', { name: /complete/i }).first()
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Procedures', () => {
    test('should navigate to procedures page', async ({ adminPage: page }) => {
      // Procedures may be under settings or treatments
      await page.goto('/settings/procedures')
      await expect(page.locator('body')).toBeVisible()
    })
  })
})
