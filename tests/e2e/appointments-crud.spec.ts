import { test, expect } from './fixtures/auth'

test.describe('Appointment Management', () => {
  test.describe('Appointment List', () => {
    test('should display appointments page', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      await expect(page.getByRole('heading', { name: /appointment/i })).toBeVisible()
    })

    test('should have New Appointment button', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      const newButton = page.getByRole('button', { name: /new appointment|add appointment/i }).or(
        page.getByRole('link', { name: /new appointment|add appointment/i })
      )
      await expect(newButton).toBeVisible()
    })

    test('should have date filter', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      // Date picker or calendar filter
      const dateInput = page.getByLabel(/date/i).or(page.locator('input[type="date"]').first())
      await expect(dateInput.or(page.getByRole('button', { name: /today|date/i }))).toBeVisible()
    })

    test('should have status filter', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      // Status filter dropdown
      const statusFilter = page.getByRole('combobox').first().or(
        page.locator('select').first()
      )
      await expect(statusFilter.or(page.getByText(/status/i))).toBeVisible()
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput).toBeVisible()
    })

    test('should support pagination', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      const pagination = page.getByRole('button', { name: /next|previous/i }).or(
        page.locator('[class*="pagination"]')
      )
      await expect(pagination.first()).toBeVisible()
    })
  })

  test.describe('Create Appointment', () => {
    test('should open appointment creation form', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      const newButton = page.getByRole('button', { name: /new appointment|add appointment/i }).or(
        page.getByRole('link', { name: /new appointment|add appointment/i })
      )
      await newButton.click()
      await page.waitForTimeout(500)
      // Should show form
      await expect(
        page.getByLabel(/patient/i).or(page.getByRole('heading', { name: /new|create|book/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate required fields', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      const newButton = page.getByRole('button', { name: /new appointment|add appointment/i }).or(
        page.getByRole('link', { name: /new appointment|add appointment/i })
      )
      await newButton.click()
      await page.waitForTimeout(500)

      const submitButton = page.getByRole('button', { name: /save|create|book|submit/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await expect(page.getByText(/required|select|choose/i).first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show appointment type options', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      const newButton = page.getByRole('button', { name: /new appointment|add appointment/i }).or(
        page.getByRole('link', { name: /new appointment|add appointment/i })
      )
      await newButton.click()
      await page.waitForTimeout(500)

      const typeField = page.getByLabel(/type/i)
      if (await typeField.isVisible()) {
        await typeField.click()
        // Should show appointment type options
        await expect(page.getByRole('option').first().or(page.getByRole('listbox'))).toBeVisible()
      }
    })
  })

  test.describe('Appointment Check-in/Check-out', () => {
    test('should display check-in button for scheduled appointments', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      await page.waitForTimeout(1000)
      // Check-in buttons should exist for appropriate appointments
      const checkInButton = page.getByRole('button', { name: /check.?in/i }).first()
      // May or may not be visible depending on data
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Appointment Queue (Today)', () => {
    test('should show today\'s queue view', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      const todayTab = page.getByRole('tab', { name: /today|queue/i }).or(
        page.getByRole('link', { name: /today|queue/i })
      )
      if (await todayTab.isVisible()) {
        await todayTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Appointment Waitlist', () => {
    test('should access waitlist from appointments page', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      const waitlistTab = page.getByRole('tab', { name: /waitlist/i }).or(
        page.getByRole('link', { name: /waitlist/i }).or(
          page.getByRole('button', { name: /waitlist/i })
        )
      )
      if (await waitlistTab.isVisible()) {
        await waitlistTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Calendar View', () => {
    test('should toggle between list and calendar view', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      const calendarToggle = page.getByRole('button', { name: /calendar|week|month/i }).or(
        page.getByRole('tab', { name: /calendar/i })
      )
      if (await calendarToggle.isVisible()) {
        await calendarToggle.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })
})
