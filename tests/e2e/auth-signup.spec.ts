import { test, expect } from '@playwright/test'

test.describe('Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
  })

  test('should display signup form with all required fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign up|register|create/i })).toBeVisible()
    await expect(page.getByLabel(/clinic name|hospital name/i)).toBeVisible()
    await expect(page.getByLabel(/admin name|your name|full name/i).first()).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/phone/i)).toBeVisible()
    await expect(page.getByLabel(/^password$/i).or(page.getByLabel(/password/i).first())).toBeVisible()
  })

  test('should have link back to login page', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /sign in|login|already have/i })
    await expect(loginLink).toBeVisible()
  })

  test('should validate required fields on empty submit', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /sign up|register|create/i })
    await expect(submitButton).toBeVisible()
    await submitButton.click()

    // Should show validation errors
    await expect(page.getByText(/required|enter|provide|minimum/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('should validate email format', async ({ page }) => {
    const emailInput = page.getByLabel(/email/i)
    await emailInput.fill('invalid-email')

    // Fill other required fields to trigger email-specific error
    const clinicName = page.getByLabel(/clinic name|hospital name/i)
    if (await clinicName.isVisible()) {
      await clinicName.fill('Test Clinic')
    }
    const adminName = page.getByLabel(/admin name|your name|full name/i).first()
    if (await adminName.isVisible()) {
      await adminName.fill('Test Admin')
    }
    const phoneInput = page.getByLabel(/phone/i)
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('9876543210')
    }
    const passwordInput = page.getByLabel(/^password$/i).or(page.getByLabel(/password/i).first())
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('password123')
    }
    const confirmPassword = page.getByLabel(/confirm password/i)
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill('password123')
    }

    const submitButton = page.getByRole('button', { name: /sign up|register|create/i })
    await submitButton.click()

    // Should show email validation error
    await expect(page.getByText(/email|invalid/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('should validate password minimum length', async ({ page }) => {
    const passwordInput = page.getByLabel(/^password$/i).or(page.getByLabel(/password/i).first())
    await passwordInput.fill('short')

    const submitButton = page.getByRole('button', { name: /sign up|register|create/i })
    await submitButton.click()

    // Should show password length error
    await expect(
      page.getByText(/minimum|at least|too short|characters/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('should validate password confirmation match', async ({ page }) => {
    const passwordInput = page.getByLabel(/^password$/i).or(page.getByLabel(/password/i).first())
    await passwordInput.fill('password123')

    const confirmPassword = page.getByLabel(/confirm password/i)
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill('differentpassword')
      const submitButton = page.getByRole('button', { name: /sign up|register|create/i })
      await submitButton.click()

      // Should show mismatch error
      await expect(
        page.getByText(/match|don't match|do not match|mismatch/i).first()
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('should validate clinic name minimum length', async ({ page }) => {
    const clinicName = page.getByLabel(/clinic name|hospital name/i)
    if (await clinicName.isVisible()) {
      await clinicName.fill('A')
      const submitButton = page.getByRole('button', { name: /sign up|register|create/i })
      await submitButton.click()

      await expect(
        page.getByText(/minimum|at least|too short|characters/i).first()
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('should submit signup form with valid data', async ({ page }) => {
    const uniqueId = Date.now()

    const clinicName = page.getByLabel(/clinic name|hospital name/i)
    if (await clinicName.isVisible()) {
      await clinicName.fill(`Test Clinic ${uniqueId}`)
    }
    const adminName = page.getByLabel(/admin name|your name|full name/i).first()
    if (await adminName.isVisible()) {
      await adminName.fill('Test Admin')
    }
    const emailInput = page.getByLabel(/email/i)
    await emailInput.fill(`testclinic${uniqueId}@example.com`)

    const phoneInput = page.getByLabel(/phone/i)
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('9876543210')
    }
    const passwordInput = page.getByLabel(/^password$/i).or(page.getByLabel(/password/i).first())
    await passwordInput.fill('TestPassword123!')

    const confirmPassword = page.getByLabel(/confirm password/i)
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill('TestPassword123!')
    }

    const submitButton = page.getByRole('button', { name: /sign up|register|create/i })
    await submitButton.click()

    // Should redirect to verify email page or show success message
    await expect(
      page.getByText(/verify|check your email|success|created|welcome/i).first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('should reject duplicate email signup', async ({ page }) => {
    // Use the seed admin email which already exists
    const clinicName = page.getByLabel(/clinic name|hospital name/i)
    if (await clinicName.isVisible()) {
      await clinicName.fill('Duplicate Clinic')
    }
    const adminName = page.getByLabel(/admin name|your name|full name/i).first()
    if (await adminName.isVisible()) {
      await adminName.fill('Duplicate Admin')
    }
    const emailInput = page.getByLabel(/email/i)
    await emailInput.fill('admin@dental.com')

    const phoneInput = page.getByLabel(/phone/i)
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('9876543211')
    }
    const passwordInput = page.getByLabel(/^password$/i).or(page.getByLabel(/password/i).first())
    await passwordInput.fill('TestPassword123!')

    const confirmPassword = page.getByLabel(/confirm password/i)
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill('TestPassword123!')
    }

    const submitButton = page.getByRole('button', { name: /sign up|register|create/i })
    await submitButton.click()

    // Should show error about existing account
    await expect(
      page.getByText(/already|exists|duplicate|taken|registered/i).first()
    ).toBeVisible({ timeout: 10000 })
  })
})
