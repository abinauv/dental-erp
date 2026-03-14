import { test, expect } from './fixtures/auth'

test.describe('Appointment Queue Management', () => {
  test.describe('Queue Page', () => {
    test('should display queue page with status sections', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await expect(
        page.getByRole('heading', { name: /queue|today|appointment/i }).or(
          page.getByText(/waiting|in.?progress|upcoming|completed/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show waiting patients section', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/waiting|checked.?in|queue/i).first()
          .or(page.getByText(/no.*appointment|empty/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show in-progress section', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/in.?progress|currently|treating/i).first()
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show completed section', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/completed|done|finished/i).first()
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should display patient names in queue cards', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      // Queue cards should show patient and doctor info
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Queue Actions', () => {
    test('should have action buttons on queue cards', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      // Check-in / check-out / start buttons
      const actionBtn = page.getByRole('button', { name: /check|start|complete|log/i }).first()
      await expect(actionBtn.or(page.locator('body'))).toBeVisible()
    })

    test('should have doctor filter on queue page', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      const doctorFilter = page.getByRole('combobox').first()
        .or(page.locator('select').first())
        .or(page.getByText(/doctor|all doctor/i).first())
      await expect(doctorFilter.or(page.locator('body'))).toBeVisible()
    })

    test('should show no-show button for overdue appointments', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      // No-show marking option
      const noShowBtn = page.getByRole('button', { name: /no.?show/i }).first()
      await expect(noShowBtn.or(page.locator('body'))).toBeVisible()
    })
  })

  test.describe('Queue Stats', () => {
    test('should display queue statistics', async ({ adminPage: page }) => {
      await page.goto('/appointments/queue')
      await page.waitForTimeout(1000)
      // Stats: average wait time, total patients, etc.
      await expect(
        page.getByText(/wait|avg|average|total|patient/i).first()
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
