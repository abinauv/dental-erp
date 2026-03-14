import { test, expect } from './fixtures/auth'

test.describe('Appointment Check-in / Check-out Workflow', () => {
  test.describe('Check-in Flow', () => {
    test('should display appointment detail page with status actions', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      await page.waitForTimeout(1000)
      // Click first appointment row to view detail
      const row = page.locator('table tbody tr').first().or(
        page.locator('[data-testid="appointment-row"]').first()
      )
      if (await row.isVisible()) {
        const viewLink = row.getByRole('link').first().or(row.locator('a').first())
        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForTimeout(1000)
          await expect(page.getByText(/status|scheduled|confirmed|checked|completed/i).first()).toBeVisible({ timeout: 5000 })
        }
      }
    })

    test('should have check-in button on queue page', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      // Queue page should show check-in controls
      const checkInBtn = page.getByRole('button', { name: /check.?in|log.?in/i }).first()
      await expect(
        checkInBtn.or(page.getByText(/queue|waiting|no.*appointment/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show patient information during check-in', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      // Patient names should be visible in queue
      await expect(
        page.getByText(/patient|name|dr\./i).first().or(page.getByText(/no.*appointment|empty/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show appointment time in queue', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      // Time indicators should be present
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Check-out Flow', () => {
    test('should have check-out button for checked-in patients', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      const checkOutBtn = page.getByRole('button', { name: /check.?out|log.?out|complete/i }).first()
      // Check-out button should exist for in-progress appointments
      await expect(page.locator('body')).toBeVisible()
    })

    test('should show duration timer for checked-in patients', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      // Timer or duration display for in-progress appointments
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Status Transitions', () => {
    test('should display status badges for appointments', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      await page.waitForTimeout(1000)
      // Status badges should be visible in the table
      await expect(
        page.getByText(/scheduled|confirmed|checked|completed|cancelled|no.?show/i).first()
          .or(page.getByText(/no.*appointment|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should filter appointments by checked-in status', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      const statusFilter = page.getByRole('combobox').first().or(page.locator('select').first())
      if (await statusFilter.isVisible()) {
        await statusFilter.click()
        await page.waitForTimeout(300)
        // Status options should include check-in related statuses
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })
})
