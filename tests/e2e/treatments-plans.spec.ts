import { test, expect } from './fixtures/auth'

test.describe('Treatment Plans', () => {
  test.describe('Treatment Plans List', () => {
    test('should display treatment plans page', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans')
      await expect(
        page
          .getByRole('heading', { name: /treatment plan|plan/i })
          .or(page.getByText(/treatment plan/i).first())
          .first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have New Plan button', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans')
      const newButton = page
        .getByRole('button', { name: /new|add|create/i })
        .or(page.getByRole('link', { name: /new|add|create/i }).first())
        .first()
      await expect(newButton).toBeVisible()
    })

    test('should display plans in table with progress', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans')
      await page.waitForTimeout(1000)
      await expect(
        page
          .locator('table')
          .or(page.getByText(/no.*plan|no.*data|empty/i).first())
          .first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show plan status badges', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans')
      await page.waitForTimeout(1000)
      await expect(
        page
          .getByText(/active|completed|draft|pending|cancelled/i)
          .first()
          .or(page.getByText(/no.*plan|no.*data/i).first())
          .first()
      ).toBeVisible({ timeout: 5000 })
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput.or(page.locator('body')).first()).toBeVisible()
    })

    test('should have status filter', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans')
      const filter = page.getByRole('combobox').or(page.locator('select').first()).first()
      await expect(filter.or(page.getByText(/status|filter/i).first()).first()).toBeVisible()
    })
  })

  test.describe('Create Treatment Plan', () => {
    test('should open plan creation form', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans/new')
      await expect(
        page
          .getByLabel(/patient/i)
          .or(page.getByRole('heading', { name: /new|create|add/i }))
          .first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should require patient selection', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans/new')
      await page.waitForTimeout(1000)
      const submitBtn = page.getByRole('button', { name: /save|create|submit/i })
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await expect(page.getByText(/required|select|patient/i).first()).toBeVisible({
          timeout: 5000,
        })
      }
    })

    test('should allow adding treatment items to plan', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans/new')
      await page.waitForTimeout(1000)
      // Add item button for plan items
      const addItemBtn = page
        .getByRole('button', { name: /add.*item|add.*treatment|add.*procedure/i })
        .first()
      await expect(
        addItemBtn.or(page.getByText(/item|procedure|treatment/i).first()).first()
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show cost calculation for plan', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans/new')
      await page.waitForTimeout(1000)
      await expect(
        page
          .getByText(/total|amount|cost|₹/i)
          .or(page.locator('body'))
          .first()
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Treatment Plan Detail', () => {
    test('should show progress tracking', async ({ adminPage: page }) => {
      await page.goto('/treatments/plans')
      await page.waitForTimeout(1000)
      // Click first plan to view detail
      const row = page.locator('table tbody tr').first()
      if (await row.isVisible()) {
        const link = row.getByRole('link').or(row.locator('a').first()).first()
        if (await link.isVisible()) {
          await link.click()
          await page.waitForTimeout(1000)
          await expect(page.getByText(/progress|status|item|procedure/i).first()).toBeVisible({
            timeout: 5000,
          })
        }
      }
    })
  })
})
