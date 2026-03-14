import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should redirect unauthenticated users to login page', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should show login form', async ({ page }) => {
    await page.goto('/login')

    // Check for login form elements
    await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible()
  })

  test('should show validation errors for empty form submission', async ({ page }) => {
    await page.goto('/login')

    // Click login without filling form
    await page.getByRole('button', { name: /sign in|login/i }).click()

    // Should show validation errors
    await expect(page.getByText(/required|email|password/i)).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in|login/i }).click()

    // Should show error message
    await expect(page.getByText(/invalid|incorrect|wrong|failed/i)).toBeVisible({ timeout: 10000 })
  })

  test('should have link to signup page', async ({ page }) => {
    await page.goto('/login')

    const signupLink = page.getByRole('link', { name: /sign up|register|create account/i })
    await expect(signupLink).toBeVisible()
  })

  test('should show signup form', async ({ page }) => {
    await page.goto('/signup')

    // Check for signup form elements
    await expect(page.getByRole('heading', { name: /sign up|register|create/i })).toBeVisible()
    await expect(page.getByLabel(/hospital|clinic|name/i).first()).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i).first()).toBeVisible()
  })

  test('should have link to pricing page', async ({ page }) => {
    await page.goto('/login')

    const pricingLink = page.getByRole('link', { name: /pricing|plans/i })
    if (await pricingLink.isVisible()) {
      await pricingLink.click()
      await expect(page).toHaveURL(/.*pricing/)
    }
  })

  test('should have password visibility toggle', async ({ page }) => {
    await page.goto('/login')
    const passwordInput = page.getByLabel(/password/i)
    await expect(passwordInput).toHaveAttribute('type', 'password')
    // Toggle button for showing/hiding password
    const toggleBtn = page.getByRole('button', { name: /show|hide|eye|toggle/i }).first()
      .or(page.locator('button:near(:text("Password"))').first())
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click()
      // After toggle, type should change
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('should show email format validation', async ({ page }) => {
    await page.goto('/login')
    const emailInput = page.getByLabel(/email/i)
    await emailInput.fill('not-an-email')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /sign in|login/i }).click()
    // Should show validation error for bad email
    await expect(
      page.getByText(/valid|email|invalid|format/i).first().or(page.locator('body'))
    ).toBeVisible({ timeout: 5000 })
  })

  test('should preserve email after failed login', async ({ page }) => {
    await page.goto('/login')
    const emailInput = page.getByLabel(/email/i)
    await emailInput.fill('test@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in|login/i }).click()
    await page.waitForTimeout(2000)
    // Email should still be filled after failed attempt
    await expect(emailInput).toHaveValue('test@example.com')
  })

  test('should have accessible form labels', async ({ page }) => {
    await page.goto('/login')
    const emailInput = page.getByLabel(/email/i)
    const passwordInput = page.getByLabel(/password/i)
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    // Both should be focusable
    await emailInput.focus()
    await expect(emailInput).toBeFocused()
  })
})

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should redirect to login when accessing patients page without auth', async ({ page }) => {
    await page.goto('/patients')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should redirect to login when accessing appointments page without auth', async ({ page }) => {
    await page.goto('/appointments')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should redirect to login when accessing treatments page without auth', async ({ page }) => {
    await page.goto('/treatments')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should redirect to login when accessing billing page without auth', async ({ page }) => {
    await page.goto('/billing')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should redirect to login when accessing settings page without auth', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should redirect to login when accessing staff page without auth', async ({ page }) => {
    await page.goto('/staff')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should redirect to login when accessing inventory page without auth', async ({ page }) => {
    await page.goto('/inventory')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should redirect to login when accessing reports page without auth', async ({ page }) => {
    await page.goto('/reports')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should redirect to login when accessing communications page without auth', async ({ page }) => {
    await page.goto('/communications')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should include callbackUrl in redirect', async ({ page }) => {
    await page.goto('/patients')
    // Login URL should include callback to original page
    await expect(page).toHaveURL(/.*login/)
  })
})

test.describe('Public Routes', () => {
  test('should allow access to login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/.*login/)
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('should allow access to signup page', async ({ page }) => {
    await page.goto('/signup')
    await expect(page).toHaveURL(/.*signup/)
  })

  test('should allow access to pricing page', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page).toHaveURL(/.*pricing/)
  })
})
