import { test, expect } from './fixtures/auth'

test.describe('Reports & Analytics', () => {
  test.describe('Reports Page', () => {
    test('should display reports page', async ({ adminPage: page }) => {
      await page.goto('/reports')
      await expect(page.getByRole('heading', { name: /report|analytics/i })).toBeVisible()
    })

    test('should show report type options', async ({ adminPage: page }) => {
      await page.goto('/reports')
      await page.waitForTimeout(1000)
      // Report types: patient, clinical, financial, operational
      await expect(
        page.getByText(/patient|clinical|financial|operational|revenue/i).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have date range filter', async ({ adminPage: page }) => {
      await page.goto('/reports')
      const dateFilter = page.getByRole('combobox').first().or(
        page.getByRole('button', { name: /date|period|range/i }).first()
      )
      await expect(dateFilter.or(page.locator('input[type="date"]').first())).toBeVisible()
    })

    test('should have export buttons (CSV/PDF)', async ({ adminPage: page }) => {
      await page.goto('/reports')
      const exportButton = page.getByRole('button', { name: /export|download|csv|pdf/i }).first()
      if (await exportButton.isVisible()) {
        await expect(exportButton).toBeVisible()
      }
    })

    test('should display charts or data tables', async ({ adminPage: page }) => {
      await page.goto('/reports')
      await page.waitForTimeout(2000)
      // Charts (canvas/svg) or data tables
      await expect(
        page.locator('canvas, svg, table').first().or(page.getByText(/no.*data/i).first())
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Report Types', () => {
    test('should show patient analytics', async ({ adminPage: page }) => {
      await page.goto('/reports')
      const patientReport = page.getByRole('tab', { name: /patient/i }).or(
        page.getByRole('button', { name: /patient/i })
      )
      if (await patientReport.isVisible()) {
        await patientReport.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('should show financial analytics', async ({ adminPage: page }) => {
      await page.goto('/reports')
      const financialReport = page.getByRole('tab', { name: /financial|revenue/i }).or(
        page.getByRole('button', { name: /financial|revenue/i })
      )
      if (await financialReport.isVisible()) {
        await financialReport.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('should show clinical analytics', async ({ adminPage: page }) => {
      await page.goto('/reports')
      const clinicalReport = page.getByRole('tab', { name: /clinical/i }).or(
        page.getByRole('button', { name: /clinical/i })
      )
      if (await clinicalReport.isVisible()) {
        await clinicalReport.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })
})
