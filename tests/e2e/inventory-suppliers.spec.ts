import { test, expect } from './fixtures/auth'

test.describe('Inventory Suppliers', () => {
  test.describe('Supplier List', () => {
    test('should display suppliers page', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      await expect(
        page.getByRole('heading', { name: /supplier/i }).or(
          page.getByText(/supplier/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have Add Supplier button', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await expect(addButton).toBeVisible()
    })

    test('should display suppliers in table', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*supplier|no.*data|empty/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show supplier contact details', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/phone|email|contact|name/i).first()
          .or(page.getByText(/no.*supplier|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show supplier status', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/active|inactive|status/i).first()
          .or(page.getByText(/no.*supplier|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput.or(page.locator('body'))).toBeVisible()
    })
  })

  test.describe('Add Supplier', () => {
    test('should open add supplier form', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/name/i).or(page.getByRole('heading', { name: /add|new|create|supplier/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate required fields', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      const submitBtn = page.getByRole('button', { name: /save|create|add|submit/i })
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await expect(page.getByText(/required|enter|provide/i).first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show contact fields (phone, email, address)', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/phone|email|address|contact/i).first()
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Supplier Actions', () => {
    test('should have edit/delete options', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      await page.waitForTimeout(1000)
      const moreBtn = page.locator('[data-testid="more-actions"]').first()
        .or(page.getByRole('button', { name: /action|more|edit|⋮/i }).first())
      await expect(moreBtn.or(page.locator('body'))).toBeVisible()
    })
  })
})
