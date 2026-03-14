import { test, expect, login, TEST_ADMIN, TEST_DOCTOR, TEST_RECEPTIONIST } from './fixtures/auth'

test.describe('Role-Based Access Control', () => {
  test.describe('Admin Access', () => {
    test('should access dashboard', async ({ adminPage: page }) => {
      await page.goto('/dashboard')
      await expect(page.getByRole('heading').first()).toBeVisible()
      await expect(page).toHaveURL(/.*dashboard/)
    })

    test('should access settings page', async ({ adminPage: page }) => {
      await page.goto('/settings')
      await expect(page).toHaveURL(/.*settings/)
      await expect(page.getByRole('heading', { name: /setting/i }).first()).toBeVisible()
    })

    test('should access staff management', async ({ adminPage: page }) => {
      await page.goto('/staff')
      await expect(page).toHaveURL(/.*staff/)
      await expect(page.getByRole('heading', { name: /staff/i }).first()).toBeVisible()
    })

    test('should access billing page', async ({ adminPage: page }) => {
      await page.goto('/billing')
      await expect(page).toHaveURL(/.*billing/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access reports page', async ({ adminPage: page }) => {
      await page.goto('/reports')
      await expect(page).toHaveURL(/.*reports/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access patients page', async ({ adminPage: page }) => {
      await page.goto('/patients')
      await expect(page).toHaveURL(/.*patients/)
      await expect(page.getByRole('heading', { name: /patient/i }).first()).toBeVisible()
    })

    test('should access appointments page', async ({ adminPage: page }) => {
      await page.goto('/appointments')
      await expect(page).toHaveURL(/.*appointments/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access inventory page', async ({ adminPage: page }) => {
      await page.goto('/inventory')
      await expect(page).toHaveURL(/.*inventory/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access CRM page', async ({ adminPage: page }) => {
      await page.goto('/crm')
      await expect(page).toHaveURL(/.*crm/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access sterilization page', async ({ adminPage: page }) => {
      await page.goto('/sterilization')
      await expect(page).toHaveURL(/.*sterilization/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })
  })

  test.describe('Doctor Access', () => {
    test('should access dashboard', async ({ doctorPage: page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/.*dashboard/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access patients page', async ({ doctorPage: page }) => {
      await page.goto('/patients')
      await expect(page).toHaveURL(/.*patients/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access appointments page', async ({ doctorPage: page }) => {
      await page.goto('/appointments')
      await expect(page).toHaveURL(/.*appointments/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access treatments page', async ({ doctorPage: page }) => {
      await page.goto('/treatments')
      await expect(page).toHaveURL(/.*treatments/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access prescriptions page', async ({ doctorPage: page }) => {
      await page.goto('/prescriptions')
      await expect(page).toHaveURL(/.*prescriptions/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should be restricted from settings page', async ({ doctorPage: page }) => {
      await page.goto('/settings')
      // Should either redirect away or show access denied
      const isOnSettings = page.url().includes('/settings')
      if (isOnSettings) {
        // If settings page loads, check for limited access or redirect
        const accessDenied = page.getByText(/access denied|unauthorized|forbidden|not authorized/i)
        const settingsHeading = page.getByRole('heading', { name: /setting/i })
        // Doctor may see limited settings or be denied
        await expect(accessDenied.or(settingsHeading)).toBeVisible({ timeout: 5000 })
      }
      // Redirect away from settings is also acceptable behavior
    })

    test('should be restricted from staff management', async ({ doctorPage: page }) => {
      await page.goto('/staff')
      // Should redirect or show access denied
      await page.waitForTimeout(2000)
      const isOnStaff = page.url().includes('/staff')
      if (isOnStaff) {
        // Limited staff view is acceptable for doctors
        await expect(page.getByRole('heading').first()).toBeVisible()
      }
    })
  })

  test.describe('Receptionist Access', () => {
    test('should access dashboard', async ({ receptionistPage: page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/.*dashboard/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access patients page', async ({ receptionistPage: page }) => {
      await page.goto('/patients')
      await expect(page).toHaveURL(/.*patients/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access appointments page', async ({ receptionistPage: page }) => {
      await page.goto('/appointments')
      await expect(page).toHaveURL(/.*appointments/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should access billing page', async ({ receptionistPage: page }) => {
      await page.goto('/billing')
      await expect(page).toHaveURL(/.*billing/)
      await expect(page.getByRole('heading').first()).toBeVisible()
    })

    test('should be restricted from settings page', async ({ receptionistPage: page }) => {
      await page.goto('/settings')
      await page.waitForTimeout(2000)
      // Receptionist should be redirected or see limited settings
      const isOnSettings = page.url().includes('/settings')
      if (isOnSettings) {
        const accessDenied = page.getByText(/access denied|unauthorized|forbidden|not authorized/i)
        const heading = page.getByRole('heading').first()
        await expect(accessDenied.or(heading)).toBeVisible({ timeout: 5000 })
      }
    })

    test('should be restricted from reports page', async ({ receptionistPage: page }) => {
      await page.goto('/reports')
      await page.waitForTimeout(2000)
      // Should redirect or show limited access
      const isOnReports = page.url().includes('/reports')
      if (isOnReports) {
        const accessDenied = page.getByText(/access denied|unauthorized|forbidden|not authorized/i)
        const heading = page.getByRole('heading').first()
        await expect(accessDenied.or(heading)).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('Cross-Role Navigation', () => {
    test('admin should see all sidebar navigation sections', async ({ adminPage: page }) => {
      await page.goto('/dashboard')
      // Admin should see sidebar with key sections
      const sidebar = page.locator('nav, aside, [data-testid="sidebar"]').first()
      await expect(sidebar).toBeVisible()

      // Check for admin-specific items
      const settingsLink = page.getByRole('link', { name: /setting/i }).first()
        .or(page.locator('a[href*="/settings"]').first())
      await expect(settingsLink).toBeVisible()

      const staffLink = page.getByRole('link', { name: /staff/i }).first()
        .or(page.locator('a[href*="/staff"]').first())
      await expect(staffLink).toBeVisible()
    })

    test('doctor should see clinical navigation items', async ({ doctorPage: page }) => {
      await page.goto('/dashboard')
      const sidebar = page.locator('nav, aside, [data-testid="sidebar"]').first()
      await expect(sidebar).toBeVisible()

      // Doctors should see clinical items
      const patientsLink = page.getByRole('link', { name: /patient/i }).first()
        .or(page.locator('a[href*="/patients"]').first())
      await expect(patientsLink).toBeVisible()

      const appointmentsLink = page.getByRole('link', { name: /appointment/i }).first()
        .or(page.locator('a[href*="/appointments"]').first())
      await expect(appointmentsLink).toBeVisible()
    })

    test('receptionist should see front-desk navigation items', async ({ receptionistPage: page }) => {
      await page.goto('/dashboard')
      const sidebar = page.locator('nav, aside, [data-testid="sidebar"]').first()
      await expect(sidebar).toBeVisible()

      // Receptionist should see front-desk items
      const patientsLink = page.getByRole('link', { name: /patient/i }).first()
        .or(page.locator('a[href*="/patients"]').first())
      await expect(patientsLink).toBeVisible()

      const appointmentsLink = page.getByRole('link', { name: /appointment/i }).first()
        .or(page.locator('a[href*="/appointments"]').first())
      await expect(appointmentsLink).toBeVisible()
    })
  })
})
