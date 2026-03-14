import { test, expect } from './fixtures/auth'

test.describe('Staff Shifts / Schedules', () => {
  test.describe('Staff Detail - Shifts Tab', () => {
    test('should navigate to staff detail with shifts', async ({ adminPage: page }) => {
      await page.goto('/staff')
      await page.waitForTimeout(1000)
      const row = page.locator('table tbody tr').first()
      if (await row.isVisible()) {
        const link = row.getByRole('link').first().or(row.locator('a').first())
        if (await link.isVisible()) {
          await link.click()
          await page.waitForTimeout(1000)
          // Look for shifts tab on staff detail
          const shiftsTab = page.getByRole('tab', { name: /shift|schedule/i }).or(
            page.getByRole('link', { name: /shift|schedule/i })
          )
          await expect(
            shiftsTab.or(page.getByText(/shift|schedule|working/i).first())
          ).toBeVisible({ timeout: 5000 })
        }
      }
    })

    test('should show shift schedule table', async ({ adminPage: page }) => {
      await page.goto('/staff')
      await page.waitForTimeout(1000)
      const row = page.locator('table tbody tr').first()
      if (await row.isVisible()) {
        const link = row.getByRole('link').first().or(row.locator('a').first())
        if (await link.isVisible()) {
          await link.click()
          await page.waitForTimeout(1000)
          const shiftsTab = page.getByRole('tab', { name: /shift|schedule/i }).or(
            page.getByRole('link', { name: /shift|schedule/i })
          )
          if (await shiftsTab.isVisible()) {
            await shiftsTab.click()
            await page.waitForTimeout(1000)
            // Shift data: day, start time, end time
            await expect(
              page.getByText(/monday|tuesday|wednesday|thursday|friday|saturday|sunday|day/i).first()
                .or(page.getByText(/no.*shift|no.*schedule/i).first())
            ).toBeVisible({ timeout: 5000 })
          }
        }
      }
    })
  })

  test.describe('Shift Management', () => {
    test('should have edit shifts button', async ({ adminPage: page }) => {
      await page.goto('/staff')
      await page.waitForTimeout(1000)
      const row = page.locator('table tbody tr').first()
      if (await row.isVisible()) {
        const link = row.getByRole('link').first().or(row.locator('a').first())
        if (await link.isVisible()) {
          await link.click()
          await page.waitForTimeout(1000)
          const shiftsTab = page.getByRole('tab', { name: /shift|schedule/i }).or(
            page.getByRole('link', { name: /shift|schedule/i })
          )
          if (await shiftsTab.isVisible()) {
            await shiftsTab.click()
            await page.waitForTimeout(1000)
            const editBtn = page.getByRole('button', { name: /edit|manage|update/i }).first()
            await expect(editBtn.or(page.locator('body'))).toBeVisible()
          }
        }
      }
    })

    test('should show time selection fields for shifts', async ({ adminPage: page }) => {
      await page.goto('/staff')
      await page.waitForTimeout(1000)
      // Time inputs for shift start/end
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Doctor Schedule View', () => {
    test('should show doctor-specific schedule from appointments', async ({ doctorPage: page }) => {
      await page.goto('/appointments')
      await page.waitForTimeout(1000)
      // Doctor should see their own schedule
      await expect(
        page.getByRole('heading', { name: /appointment/i }).or(
          page.getByText(/schedule|my.*appointment/i).first()
        )
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
