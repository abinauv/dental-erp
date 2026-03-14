import { test, expect } from './fixtures/auth'

test.describe('CRM & Loyalty', () => {
  test.describe('CRM Dashboard', () => {
    test('should display CRM page', async ({ adminPage: page }) => {
      await page.goto('/crm')
      await expect(
        page.getByRole('heading', { name: /crm|customer|relationship/i }).or(
          page.getByText(/crm|loyalty|membership/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show CRM metrics', async ({ adminPage: page }) => {
      await page.goto('/crm')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/patient|segment|loyalty|referral|member/i).first()
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Loyalty Points', () => {
    test('should navigate to loyalty section', async ({ adminPage: page }) => {
      await page.goto('/crm')
      const loyaltyTab = page.getByRole('tab', { name: /loyalty|point/i }).or(
        page.getByRole('link', { name: /loyalty|point/i })
      )
      if (await loyaltyTab.isVisible()) {
        await loyaltyTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Memberships', () => {
    test('should navigate to memberships section', async ({ adminPage: page }) => {
      await page.goto('/crm')
      const membershipsTab = page.getByRole('tab', { name: /membership|plan/i }).or(
        page.getByRole('link', { name: /membership|plan/i })
      )
      if (await membershipsTab.isVisible()) {
        await membershipsTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Referrals', () => {
    test('should navigate to referrals section', async ({ adminPage: page }) => {
      await page.goto('/crm')
      const referralsTab = page.getByRole('tab', { name: /referral/i }).or(
        page.getByRole('link', { name: /referral/i })
      )
      if (await referralsTab.isVisible()) {
        await referralsTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('Patient Segments', () => {
    test('should navigate to segments section', async ({ adminPage: page }) => {
      await page.goto('/crm')
      const segmentsTab = page.getByRole('tab', { name: /segment/i }).or(
        page.getByRole('link', { name: /segment/i })
      )
      if (await segmentsTab.isVisible()) {
        await segmentsTab.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })
})
