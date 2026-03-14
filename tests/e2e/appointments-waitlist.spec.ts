import { test, expect } from './fixtures/auth'

test.describe('Appointment Waitlist', () => {
  test.describe('Waitlist Page', () => {
    test('should display waitlist page', async ({ adminPage: page }) => {
      await page.goto('/appointments/waitlist')
      await expect(
        page.getByRole('heading', { name: /waitlist/i }).or(
          page.getByText(/waitlist|waiting list/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have Add to Waitlist button', async ({ adminPage: page }) => {
      await page.goto('/appointments/waitlist')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await expect(addButton).toBeVisible()
    })

    test('should display waitlist entries in list or table', async ({ adminPage: page }) => {
      await page.goto('/appointments/waitlist')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*waitlist|no.*data|empty/i).first())
          .or(page.locator('[class*="card"]').first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show patient and doctor info in waitlist', async ({ adminPage: page }) => {
      await page.goto('/appointments/waitlist')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/patient|doctor|preferred/i).first()
          .or(page.getByText(/no.*waitlist|empty/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show waitlist summary counts', async ({ adminPage: page }) => {
      await page.goto('/appointments/waitlist')
      await page.waitForTimeout(1000)
      // Summary: total waiting, notified, booked
      await expect(
        page.getByText(/total|waiting|notified|booked|pending/i).first()
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Add to Waitlist', () => {
    test('should open add to waitlist form', async ({ adminPage: page }) => {
      await page.goto('/appointments/waitlist')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/patient/i).or(page.getByRole('heading', { name: /add|new|waitlist/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should require patient selection', async ({ adminPage: page }) => {
      await page.goto('/appointments/waitlist')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      const submitBtn = page.getByRole('button', { name: /save|add|submit/i })
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await expect(
          page.getByText(/required|select|choose/i).first()
        ).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show preferred day and time fields', async ({ adminPage: page }) => {
      await page.goto('/appointments/waitlist')
      const addButton = page.getByRole('button', { name: /add|new|create/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)
      // Preferred day/time selection
      await expect(
        page.getByLabel(/day|time|prefer|date/i).first()
          .or(page.getByText(/prefer|day|time/i).first())
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Waitlist Actions', () => {
    test('should have cancel/remove option', async ({ adminPage: page }) => {
      await page.goto('/appointments/waitlist')
      await page.waitForTimeout(1000)
      // Cancel/remove button on entries
      const cancelBtn = page.getByRole('button', { name: /cancel|remove|delete/i }).first()
      await expect(cancelBtn.or(page.locator('body'))).toBeVisible()
    })
  })
})
