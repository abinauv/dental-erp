import { test as base, expect, Page } from '@playwright/test'

// Test credentials — should match seed data
const TEST_ADMIN = {
  email: 'admin@dental.com',
  password: 'password123',
}

const TEST_DOCTOR = {
  email: 'doctor@dental.com',
  password: 'password123',
}

const TEST_RECEPTIONIST = {
  email: 'receptionist@dental.com',
  password: 'password123',
}

/**
 * Login helper — fills the login form and submits
 */
async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|login/i }).click()
  // Wait for navigation away from login page
  await page.waitForURL(/.*(?:dashboard|onboarding)/, { timeout: 15000 })
}

/**
 * Extended test fixture that provides pre-authenticated pages
 */
export const test = base.extend<{
  adminPage: Page
  doctorPage: Page
  receptionistPage: Page
}>({
  adminPage: async ({ page }, use) => {
    await login(page, TEST_ADMIN.email, TEST_ADMIN.password)
    await use(page)
  },
  doctorPage: async ({ page }, use) => {
    await login(page, TEST_DOCTOR.email, TEST_DOCTOR.password)
    await use(page)
  },
  receptionistPage: async ({ page }, use) => {
    await login(page, TEST_RECEPTIONIST.email, TEST_RECEPTIONIST.password)
    await use(page)
  },
})

export { expect, login, TEST_ADMIN, TEST_DOCTOR, TEST_RECEPTIONIST }
