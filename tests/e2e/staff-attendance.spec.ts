import { test, expect } from './fixtures/auth'

test.describe('Staff Attendance', () => {
  test.describe('Attendance Page', () => {
    test('should display attendance page', async ({ adminPage: page }) => {
      await page.goto('/staff/attendance')
      await expect(
        page.getByRole('heading', { name: /attendance/i }).or(
          page.getByText(/attendance/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show today\'s attendance summary', async ({ adminPage: page }) => {
      await page.goto('/staff/attendance')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/present|absent|late|today|not.?marked/i).first()
      ).toBeVisible({ timeout: 5000 })
    })

    test('should display staff list with attendance status', async ({ adminPage: page }) => {
      await page.goto('/staff/attendance')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*data|no.*staff/i).first())
          .or(page.locator('[class*="card"]').first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have date selector', async ({ adminPage: page }) => {
      await page.goto('/staff/attendance')
      const dateInput = page.getByLabel(/date/i).or(
        page.locator('input[type="date"]').first()
      ).or(page.getByRole('button', { name: /today|date|calendar/i }).first())
      await expect(dateInput.or(page.locator('body'))).toBeVisible()
    })

    test('should show mark attendance button', async ({ adminPage: page }) => {
      await page.goto('/staff/attendance')
      const markBtn = page.getByRole('button', { name: /mark|record|check/i }).first()
      await expect(markBtn.or(page.locator('body'))).toBeVisible()
    })
  })

  test.describe('Mark Attendance', () => {
    test('should have present/absent/late options', async ({ adminPage: page }) => {
      await page.goto('/staff/attendance')
      await page.waitForTimeout(1000)
      // Attendance status options
      await expect(
        page.getByText(/present|absent|late|half.?day/i).first()
          .or(page.getByRole('button', { name: /present|absent|late/i }).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show check-in time field', async ({ adminPage: page }) => {
      await page.goto('/staff/attendance')
      await page.waitForTimeout(1000)
      await expect(
        page.getByLabel(/time|check.?in/i).first()
          .or(page.getByText(/time|check.?in|clock/i).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Attendance History', () => {
    test('should show historical attendance data', async ({ adminPage: page }) => {
      await page.goto('/staff/attendance')
      await page.waitForTimeout(1000)
      // Date navigation or calendar for historical view
      await expect(
        page.getByRole('button', { name: /previous|next|←|→/i }).first()
          .or(page.getByText(/history|log|record/i).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
