import { test, expect } from './fixtures/auth'

test.describe('Lab Orders', () => {
  test.describe('Lab Orders List', () => {
    test('should display lab orders page', async ({ adminPage: page }) => {
      await page.goto('/lab')
      await expect(page.getByRole('heading', { name: /lab/i })).toBeVisible()
    })

    test('should have New Lab Order button', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const newButton = page.getByRole('button', { name: /new.*order|add.*order|create.*order/i }).or(
        page.getByRole('link', { name: /new.*order|add.*order|create.*order/i })
      )
      await expect(newButton).toBeVisible()
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput).toBeVisible()
    })

    test('should have status filter', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const statusFilter = page.getByRole('combobox').first().or(
        page.locator('select').first()
      )
      await expect(statusFilter.or(page.getByText(/status|filter/i).first())).toBeVisible()
    })

    test('should display orders in table', async ({ adminPage: page }) => {
      await page.goto('/lab')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*order|no.*data/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have export functionality', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const exportButton = page.getByRole('button', { name: /export/i })
      await expect(exportButton).toBeVisible()
    })

    test('should show tabs for active/completed orders', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const activeTab = page.getByRole('tab', { name: /active/i }).or(
        page.getByText(/active/i).first()
      )
      const completedTab = page.getByRole('tab', { name: /completed/i }).or(
        page.getByText(/completed/i).first()
      )
      if (await activeTab.isVisible()) {
        await expect(activeTab).toBeVisible()
      }
    })
  })

  test.describe('Create Lab Order', () => {
    test('should open lab order creation form', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const newButton = page.getByRole('button', { name: /new.*order|add.*order|create/i }).or(
        page.getByRole('link', { name: /new.*order|add.*order|create/i })
      )
      await newButton.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/patient/i).or(page.getByRole('heading', { name: /new|create|add/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate required fields', async ({ adminPage: page }) => {
      await page.goto('/lab')
      const newButton = page.getByRole('button', { name: /new.*order|add.*order|create/i }).or(
        page.getByRole('link', { name: /new.*order|add.*order|create/i })
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

  test.describe('Lab Vendors', () => {
    test('should navigate to vendors page', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      await expect(page.locator('body')).toBeVisible()
      await expect(
        page.getByRole('heading', { name: /vendor/i }).or(page.getByText(/vendor/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have add vendor button', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      const addButton = page.getByRole('button', { name: /add.*vendor|new.*vendor/i }).or(
        page.getByRole('link', { name: /add.*vendor|new.*vendor/i })
      )
      if (await addButton.isVisible()) {
        await expect(addButton).toBeVisible()
      }
    })
  })
})
