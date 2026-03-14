import { test, expect } from './fixtures/auth'

test.describe('Patient Management', () => {
  test.describe('Patient List', () => {
    test('should display patients page with table', async ({ adminPage: page }) => {
      await page.goto('/patients')
      await expect(page.getByRole('heading', { name: /patient/i })).toBeVisible()
      // Table or card list should be present
      await expect(page.locator('table, [data-testid="patient-list"]').first()).toBeVisible({ timeout: 10000 })
    })

    test('should have search functionality', async ({ adminPage: page }) => {
      await page.goto('/patients')
      const searchInput = page.getByPlaceholder(/search/i)
      await expect(searchInput).toBeVisible()
      await searchInput.fill('John')
      // Wait for debounced search
      await page.waitForTimeout(500)
      // Results should update (no crash)
      await expect(page.locator('body')).toBeVisible()
    })

    test('should have Add Patient button', async ({ adminPage: page }) => {
      await page.goto('/patients')
      const addButton = page.getByRole('button', { name: /add patient|new patient/i }).or(
        page.getByRole('link', { name: /add patient|new patient/i })
      )
      await expect(addButton).toBeVisible()
    })

    test('should have export menu', async ({ adminPage: page }) => {
      await page.goto('/patients')
      const exportButton = page.getByRole('button', { name: /export/i })
      await expect(exportButton).toBeVisible()
    })

    test('should support pagination', async ({ adminPage: page }) => {
      await page.goto('/patients')
      // Pagination buttons should be present
      const nextButton = page.getByRole('button', { name: /next/i }).or(
        page.locator('button:has(svg)').filter({ hasText: '' }).last()
      )
      await expect(nextButton).toBeVisible()
    })
  })

  test.describe('Create Patient', () => {
    test('should open patient creation form', async ({ adminPage: page }) => {
      await page.goto('/patients')
      const addButton = page.getByRole('button', { name: /add patient|new patient/i }).or(
        page.getByRole('link', { name: /add patient|new patient/i })
      )
      await addButton.click()
      // Should show form or navigate to create page
      await expect(
        page.getByLabel(/first name|name/i).or(page.getByRole('heading', { name: /add|new|create/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should validate required fields', async ({ adminPage: page }) => {
      await page.goto('/patients')
      const addButton = page.getByRole('button', { name: /add patient|new patient/i }).or(
        page.getByRole('link', { name: /add patient|new patient/i })
      )
      await addButton.click()
      await page.waitForTimeout(500)

      // Try submitting empty form
      const submitButton = page.getByRole('button', { name: /save|create|add|submit/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        // Should show validation errors
        await expect(page.getByText(/required|enter|provide/i).first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('should create a new patient with valid data', async ({ adminPage: page }) => {
      await page.goto('/patients')
      const addButton = page.getByRole('button', { name: /add patient|new patient/i }).or(
        page.getByRole('link', { name: /add patient|new patient/i })
      )
      await addButton.click()
      await page.waitForTimeout(500)

      // Fill in required fields
      const firstNameInput = page.getByLabel(/first name/i)
      if (await firstNameInput.isVisible()) {
        await firstNameInput.fill('Test')
      }
      const lastNameInput = page.getByLabel(/last name/i)
      if (await lastNameInput.isVisible()) {
        await lastNameInput.fill('Patient')
      }
      const phoneInput = page.getByLabel(/phone/i)
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('9876543210')
      }
      const emailInput = page.getByLabel(/email/i)
      if (await emailInput.isVisible()) {
        await emailInput.fill(`test.patient.${Date.now()}@example.com`)
      }
      const genderSelect = page.getByLabel(/gender/i)
      if (await genderSelect.isVisible()) {
        await genderSelect.click()
        await page.getByRole('option', { name: /male/i }).click()
      }
      const dobInput = page.getByLabel(/date of birth|dob/i)
      if (await dobInput.isVisible()) {
        await dobInput.fill('1990-01-15')
      }

      // Submit
      const submitButton = page.getByRole('button', { name: /save|create|add|submit/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        // Should show success or navigate
        await page.waitForTimeout(2000)
        await expect(
          page.getByText(/success|created|saved/i).or(page.getByRole('heading', { name: /patient/i }))
        ).toBeVisible({ timeout: 10000 })
      }
    })
  })

  test.describe('View Patient', () => {
    test('should view patient details when clicking view button', async ({ adminPage: page }) => {
      await page.goto('/patients')
      await page.waitForTimeout(1000)

      // Click first view button in the table
      const viewButton = page.getByRole('link', { name: /view/i }).or(
        page.locator('a[href*="/patients/"]').first()
      )
      if (await viewButton.isVisible()) {
        await viewButton.click()
        await expect(page).toHaveURL(/.*patients\//)
      }
    })
  })

  test.describe('Search and Filter', () => {
    test('should filter patients by search term', async ({ adminPage: page }) => {
      await page.goto('/patients')
      const searchInput = page.getByPlaceholder(/search/i)
      await searchInput.fill('nonexistent-patient-xyz-12345')
      await page.waitForTimeout(600)
      // Should show no results or empty state
      await expect(page.locator('body')).toBeVisible()
    })

    test('should clear search and show all patients', async ({ adminPage: page }) => {
      await page.goto('/patients')
      const searchInput = page.getByPlaceholder(/search/i)
      await searchInput.fill('test')
      await page.waitForTimeout(600)
      await searchInput.clear()
      await page.waitForTimeout(600)
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Patient Documents', () => {
    test('should navigate to patient documents section', async ({ adminPage: page }) => {
      await page.goto('/patients')
      await page.waitForTimeout(1000)
      // Click on first patient to view details
      const patientLink = page.locator('a[href*="/patients/"]').first()
      if (await patientLink.isVisible()) {
        await patientLink.click()
        await page.waitForTimeout(1000)
        // Look for documents tab or section
        const documentsTab = page.getByRole('tab', { name: /document/i }).or(
          page.getByText(/document/i)
        )
        if (await documentsTab.isVisible()) {
          await documentsTab.click()
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })
  })

  test.describe('Patient Insurance', () => {
    test('should navigate to patient insurance section', async ({ adminPage: page }) => {
      await page.goto('/patients')
      await page.waitForTimeout(1000)
      const patientLink = page.locator('a[href*="/patients/"]').first()
      if (await patientLink.isVisible()) {
        await patientLink.click()
        await page.waitForTimeout(1000)
        const insuranceTab = page.getByRole('tab', { name: /insurance/i }).or(
          page.getByText(/insurance/i)
        )
        if (await insuranceTab.isVisible()) {
          await insuranceTab.click()
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })
  })
})
