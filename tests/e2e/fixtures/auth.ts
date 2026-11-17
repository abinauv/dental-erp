import { test as base, expect, Page } from '@playwright/test'

// Test credentials — these MUST stay in sync with prisma/seed.ts.
// Every authenticated spec logs in through these fixtures, so a mismatch fails
// the entire suite at fixture setup rather than in any one test.
const TEST_ADMIN = {
  email: 'admin@demo-dental.com',
  password: 'Admin@123',
}

const TEST_DOCTOR = {
  email: 'doctor@demo-dental.com',
  password: 'Doctor@123',
}

const TEST_RECEPTIONIST = {
  email: 'reception@demo-dental.com',
  password: 'Reception@123',
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

// Each test is its own client as far as the app's per-IP rate limits go.
// Sign-in allows 5 attempts a minute per IP (lib/auth.ts), and the OTP,
// booking and payment-link routes have limits of their own: with every test
// coming from 127.0.0.1, the suite exhausted them within seconds and most
// specs failed at login. The app reads the client from X-Forwarded-For, as it
// does behind the bundled reverse proxy.
let clients = 0
function clientIp(workerIndex: number): string {
  clients++
  return `10.${100 + (workerIndex % 100)}.${(clients >> 8) & 255}.${clients & 255}`
}

/**
 * Extended test fixture: a fresh client address for every test, plus
 * pre-authenticated pages. Specs import `test` from here, not
 * @playwright/test.
 */
export const test = base.extend<{
  adminPage: Page
  doctorPage: Page
  receptionistPage: Page
}>({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, testInfo) => {
    await use({ ...extraHTTPHeaders, 'x-forwarded-for': clientIp(testInfo.workerIndex) })
  },
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
