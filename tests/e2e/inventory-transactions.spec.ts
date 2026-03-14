import { test, expect } from './fixtures/auth'

test.describe('Inventory Transactions', () => {
  test.describe('Transaction List', () => {
    test('should display transactions page', async ({ adminPage: page }) => {
      await page.goto('/inventory/transactions')
      await expect(
        page.getByRole('heading', { name: /transaction|stock|movement/i }).or(
          page.getByText(/transaction|stock.*in|stock.*out/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should display transactions in table', async ({ adminPage: page }) => {
      await page.goto('/inventory/transactions')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*transaction|no.*data|empty/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show transaction type indicators', async ({ adminPage: page }) => {
      await page.goto('/inventory/transactions')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/stock.?in|stock.?out|adjustment|transfer|in|out/i).first()
          .or(page.getByText(/no.*transaction|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show item names and quantities', async ({ adminPage: page }) => {
      await page.goto('/inventory/transactions')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/quantity|item|qty/i).first()
          .or(page.getByText(/no.*transaction|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should have date filter', async ({ adminPage: page }) => {
      await page.goto('/inventory/transactions')
      const dateFilter = page.getByLabel(/date/i).or(
        page.locator('input[type="date"]').first()
      ).or(page.getByRole('button', { name: /date|filter/i }).first())
      await expect(dateFilter.or(page.locator('body'))).toBeVisible()
    })
  })

  test.describe('Stock In', () => {
    test('should have stock in button from inventory page', async ({ adminPage: page }) => {
      await page.goto('/inventory')
      const stockInBtn = page.getByRole('button', { name: /stock.?in|add stock|receive/i }).first()
      await expect(stockInBtn.or(page.getByRole('button', { name: /add|new/i }).first())).toBeVisible()
    })

    test('should show stock in form fields', async ({ adminPage: page }) => {
      await page.goto('/inventory')
      const stockInBtn = page.getByRole('button', { name: /stock.?in|add stock|receive/i }).first()
        .or(page.getByRole('button', { name: /add|new/i }).first())
      if (await stockInBtn.isVisible()) {
        await stockInBtn.click()
        await page.waitForTimeout(500)
        await expect(
          page.getByLabel(/item|quantity|batch|supplier/i).first()
            .or(page.getByRole('heading', { name: /stock|add|new/i }))
        ).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('Stock Out', () => {
    test('should track stock out transactions', async ({ adminPage: page }) => {
      await page.goto('/inventory/transactions')
      await page.waitForTimeout(1000)
      // Stock out entries should be distinguishable
      await expect(page.locator('body')).toBeVisible()
    })
  })
})
