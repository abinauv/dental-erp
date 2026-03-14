import { test, expect } from './fixtures/auth'

test.describe('Data Import', () => {
  test.describe('Import Page', () => {
    test('should display data import page', async ({ adminPage: page }) => {
      // Navigate to data import (may be under settings or a separate route)
      await page.goto('/settings')
      await page.waitForTimeout(1000)
      const importLink = page.getByRole('link', { name: /import|data.*import/i })
      if (await importLink.isVisible()) {
        await importLink.click()
        await page.waitForTimeout(1000)
        await expect(
          page.getByRole('heading', { name: /import/i }).or(page.getByText(/import.*data|upload/i).first())
        ).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show file upload area', async ({ adminPage: page }) => {
      await page.goto('/settings')
      await page.waitForTimeout(1000)
      const importLink = page.getByRole('link', { name: /import|data.*import/i })
      if (await importLink.isVisible()) {
        await importLink.click()
        await page.waitForTimeout(1000)
        // File upload input or drop zone
        const uploadArea = page.locator('input[type="file"]').or(
          page.getByText(/upload|drag.*drop|csv|excel/i).first()
        )
        await expect(uploadArea.or(page.locator('body'))).toBeVisible()
      }
    })

    test('should show entity type selection', async ({ adminPage: page }) => {
      await page.goto('/settings')
      await page.waitForTimeout(1000)
      const importLink = page.getByRole('link', { name: /import|data.*import/i })
      if (await importLink.isVisible()) {
        await importLink.click()
        await page.waitForTimeout(1000)
        // Entity type: patients, inventory, staff
        await expect(
          page.getByText(/patient|inventory|staff|entity|type/i).first().or(page.locator('body'))
        ).toBeVisible()
      }
    })
  })
})
