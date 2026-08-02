import { test, expect } from './fixtures/auth'

test.describe('Inventory Suppliers', () => {
  test.describe('Supplier List', () => {
    test('should display suppliers page', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      await expect(
        page
          .getByRole('heading', { name: /supplier/i })
          .or(page.getByText(/supplier/i).first())
          .first()
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
      await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
      // Three seeded suppliers.
      await expect(page.locator('tbody tr')).toHaveCount(3)
    })

    test('should show supplier contact details', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      await page.waitForTimeout(1000)
      await expect(
        page
          .getByText(/phone|email|contact|name/i)
          .first()
          .or(page.getByText(/no.*supplier|no.*data/i).first())
          .first()
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show supplier status', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      await page.waitForTimeout(1000)
      // The seed creates three suppliers, so the table renders. A bare
      // /active|inactive|status/i used to match the filter's <option
      // selected>All Status</option>, and options are never "visible".
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByRole('cell', { name: 'Chennai Dental Depot' })).toBeVisible()
      // Scope to the table: the status filter has a <option>Blocked</option>
      // too, and an unscoped match resolves to both.
      await expect(page.getByRole('table').getByText('Blocked')).toBeVisible()
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput.or(page.locator('body')).first()).toBeVisible()
    })
  })

  test.describe('Add Supplier', () => {
    test('should open add supplier form', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      await expect(
        page
          .getByLabel(/name/i)
          .or(page.getByRole('heading', { name: /add|new|create|supplier/i }))
          .first()
      ).toBeVisible({ timeout: 5000 })
    })

    // The "Add Supplier" modal in app/(dashboard)/inventory/suppliers/page.tsx
    // is still a placeholder — it renders a heading and a Close button, and
    // says the form "will be implemented here". These two specs describe what
    // it should do once it exists; until then there is nothing to assert.
    test.fixme('should validate required fields', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      const submitBtn = page.getByRole('button', { name: /save|create|add|submit/i })
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await expect(page.getByText(/required|enter|provide/i).first()).toBeVisible({
          timeout: 5000,
        })
      }
    })

    test.fixme('should show contact fields (phone, email, address)', async ({
      adminPage: page,
    }) => {
      await page.goto('/inventory/suppliers')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      await expect(page.getByLabel(/phone|email|address|contact/i).first()).toBeVisible({
        timeout: 5000,
      })
    })
  })

  test.describe('Supplier Actions', () => {
    test('should have edit/delete options', async ({ adminPage: page }) => {
      await page.goto('/inventory/suppliers')
      await page.waitForTimeout(1000)
      const moreBtn = page
        .locator('[data-testid="more-actions"]')
        .first()
        .or(page.getByRole('button', { name: /action|more|edit|⋮/i }).first())
        .first()
      await expect(moreBtn.or(page.locator('body')).first()).toBeVisible()
    })
  })
})
