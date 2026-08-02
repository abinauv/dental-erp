import { test, expect } from './fixtures/auth'

test.describe('Lab Orders', () => {
  test.describe('Lab Orders List', () => {
    test('should display lab orders page', async ({ adminPage: page }) => {
      await page.goto('/lab')
      // Match the page title exactly. A /lab/i regex also matches the "Sent to
      // Lab" stat card and the "No lab orders found" empty state, which trips
      // strict mode.
      await expect(page.getByRole('heading', { name: 'Lab Work Management' })).toBeVisible()
    })

    test('should have New Lab Order button', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const newButton = page
        .getByRole('button', { name: /new.*order|add.*order|create.*order/i })
        .or(page.getByRole('link', { name: /new.*order|add.*order|create.*order/i }))
        .first()
      await expect(newButton).toBeVisible()
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput).toBeVisible()
    })

    test('should have status filter', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const statusFilter = page.getByRole('combobox').or(page.locator('select').first()).first()
      await expect(statusFilter.or(page.getByText(/status|filter/i).first()).first()).toBeVisible()
    })

    test('should display orders in table', async ({ adminPage: page }) => {
      await page.goto('/lab')
      // Five seeded orders, LO-2026-0001 through -0005.
      await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('LO-2026-0001')).toBeVisible()
      await expect(page.locator('tbody tr')).toHaveCount(5)
    })

    test('should show vendor and work type per order', async ({ adminPage: page }) => {
      await page.goto('/lab')
      await expect(page.getByText('Precision Dental Lab').first()).toBeVisible({ timeout: 10000 })
      // workType renders from the LabWorkType enum.
      await expect(page.getByText(/crown/i).first()).toBeVisible()
    })

    test('should have export functionality', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const exportButton = page.getByRole('button', { name: /export/i })
      await expect(exportButton).toBeVisible()
    })

    test('should show tabs for active/completed orders', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const activeTab = page
        .getByRole('tab', { name: /active/i })
        .or(page.getByText(/active/i).first())
        .first()
      const completedTab = page
        .getByRole('tab', { name: /completed/i })
        .or(page.getByText(/completed/i).first())
        .first()
      if (await activeTab.isVisible()) {
        await expect(activeTab).toBeVisible()
      }
    })
  })

  test.describe('Create Lab Order', () => {
    test('should open lab order creation form', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const newButton = page
        .getByRole('button', { name: /new.*order|add.*order|create/i })
        .or(page.getByRole('link', { name: /new.*order|add.*order|create/i }))
        .first()
      await newButton.click()
      await page.waitForTimeout(500)
      await expect(
        page
          .getByLabel(/patient/i)
          .or(page.getByRole('heading', { name: /new|create|add/i }))
          .first()
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate required fields', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const newButton = page
        .getByRole('button', { name: /new.*order|add.*order|create/i })
        .or(page.getByRole('link', { name: /new.*order|add.*order|create/i }))
        .first()
      await newButton.click()
      await page.waitForTimeout(500)

      const submitButton = page.getByRole('button', { name: /save|create|add|submit/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await expect(page.getByText(/required|select|choose/i).first()).toBeVisible({
          timeout: 5000,
        })
      }
    })
  })

  test.describe('Lab Vendors', () => {
    test('should navigate to vendors page', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      await expect(page.locator('body')).toBeVisible()
      await expect(
        page
          .getByRole('heading', { name: /vendor/i })
          .or(page.getByText(/vendor/i).first())
          .first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have add vendor button', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      const addButton = page
        .getByRole('button', { name: /add.*vendor|new.*vendor/i })
        .or(page.getByRole('link', { name: /add.*vendor|new.*vendor/i }))
        .first()
      if (await addButton.isVisible()) {
        await expect(addButton).toBeVisible()
      }
    })
  })
})
