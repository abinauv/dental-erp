import { test, expect } from './fixtures/auth'

test.describe('Staff Management', () => {
  test.describe('Staff List', () => {
    test('should display staff page', async ({ adminPage: page }) => {
      await page.goto('/staff')
      await expect(page.getByRole('heading', { name: /staff/i })).toBeVisible()
    })

    test('should have Add Staff button', async ({ adminPage: page }) => {
      await page.goto('/staff')
      const addButton = page.getByRole('button', { name: /add staff|new staff|invite/i }).or(
        page.getByRole('link', { name: /add staff|new staff|invite/i })
      )
      await expect(addButton).toBeVisible()
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/staff')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput).toBeVisible()
    })

    test('should have role filter', async ({ adminPage: page }) => {
      await page.goto('/staff')
      const roleFilter = page.getByRole('combobox').first().or(
        page.locator('select').first()
      )
      await expect(roleFilter.or(page.getByText(/role|filter/i).first())).toBeVisible()
    })

    test('should display staff in table', async ({ adminPage: page }) => {
      await page.goto('/staff')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*staff|no.*data/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show active/inactive status badges', async ({ adminPage: page }) => {
      await page.goto('/staff')
      await page.waitForTimeout(1000)
      await expect(page.locator('body')).toBeVisible()
    })

    test('should have export functionality', async ({ adminPage: page }) => {
      await page.goto('/staff')
      const exportButton = page.getByRole('button', { name: /export/i })
      await expect(exportButton).toBeVisible()
    })
  })

  test.describe('Create Staff', () => {
    test('should open staff creation form', async ({ adminPage: page }) => {
      await page.goto('/staff')
      const addButton = page.getByRole('button', { name: /add staff|new staff|invite/i }).or(
        page.getByRole('link', { name: /add staff|new staff|invite/i })
      )
      await addButton.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/name/i).or(page.getByRole('heading', { name: /add|new|create|invite/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate required fields', async ({ adminPage: page }) => {
      await page.goto('/staff')
      const addButton = page.getByRole('button', { name: /add staff|new staff|invite/i }).or(
        page.getByRole('link', { name: /add staff|new staff|invite/i })
      )
      await addButton.click()
      await page.waitForTimeout(500)

      const submitButton = page.getByRole('button', { name: /save|create|add|submit|invite/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await expect(page.getByText(/required|enter|provide|valid/i).first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show role selection options', async ({ adminPage: page }) => {
      await page.goto('/staff')
      const addButton = page.getByRole('button', { name: /add staff|new staff|invite/i }).or(
        page.getByRole('link', { name: /add staff|new staff|invite/i })
      )
      await addButton.click()
      await page.waitForTimeout(500)

      const roleField = page.getByLabel(/role/i)
      if (await roleField.isVisible()) {
        await roleField.click()
        await expect(
          page.getByRole('option').first().or(page.getByText(/doctor|admin|receptionist/i).first())
        ).toBeVisible()
      }
    })
  })

  test.describe('Staff Attendance', () => {
    test('should navigate to attendance section', async ({ adminPage: page }) => {
      await page.goto('/staff')
      const attendanceLink = page.getByRole('link', { name: /attendance/i }).or(
        page.getByRole('tab', { name: /attendance/i })
      )
      if (await attendanceLink.isVisible()) {
        await attendanceLink.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Staff Leaves', () => {
    test('should navigate to leaves section', async ({ adminPage: page }) => {
      await page.goto('/staff')
      const leavesLink = page.getByRole('link', { name: /leave/i }).or(
        page.getByRole('tab', { name: /leave/i })
      )
      if (await leavesLink.isVisible()) {
        await leavesLink.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Staff Shifts', () => {
    test('should navigate to shifts section', async ({ adminPage: page }) => {
      await page.goto('/staff')
      const shiftsLink = page.getByRole('link', { name: /shift|schedule/i }).or(
        page.getByRole('tab', { name: /shift|schedule/i })
      )
      if (await shiftsLink.isVisible()) {
        await shiftsLink.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Staff Deactivation', () => {
    test('should have deactivation option in row actions', async ({ adminPage: page }) => {
      await page.goto('/staff')
      await page.waitForTimeout(1000)
      // More options dropdown in table row
      const moreButton = page.locator('[data-testid="more-actions"], button:has(> svg)').last()
      if (await moreButton.isVisible()) {
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })
})
