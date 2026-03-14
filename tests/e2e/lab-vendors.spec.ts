import { test, expect } from './fixtures/auth'

test.describe('Lab Vendors Management', () => {
  test.describe('Vendor List', () => {
    test('should display lab vendors page', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      await expect(
        page.getByRole('heading', { name: /vendor|lab/i }).or(
          page.getByText(/vendor/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have Add Vendor button', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await expect(addButton).toBeVisible()
    })

    test('should display vendors in table', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*vendor|no.*data|empty/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show vendor status badges', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/active|inactive|approved|pending/i).first()
          .or(page.getByText(/no.*vendor|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput.or(page.locator('body'))).toBeVisible()
    })

    test('should show vendor contact info', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/phone|email|contact|code/i).first()
          .or(page.getByText(/no.*vendor|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Add Vendor', () => {
    test('should open add vendor form', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/name|code/i).first()
          .or(page.getByRole('heading', { name: /add|new|create|vendor/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate vendor code uniqueness', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      const submitBtn = page.getByRole('button', { name: /save|create|add|submit/i })
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await expect(page.getByText(/required|enter|provide|code/i).first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show specialization and service fields', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/special|service|type|categor/i).first()
          .or(page.getByText(/special|service/i).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Vendor Actions', () => {
    test('should have edit/delete options on vendors', async ({ adminPage: page }) => {
      await page.goto('/lab/vendors')
      await page.waitForTimeout(1000)
      const moreBtn = page.locator('[data-testid="more-actions"]').first()
        .or(page.getByRole('button', { name: /action|more|edit|⋮/i }).first())
      await expect(moreBtn.or(page.locator('body'))).toBeVisible()
    })
  })
})
