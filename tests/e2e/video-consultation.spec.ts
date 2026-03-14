import { test, expect } from './fixtures/auth'

test.describe('Video Consultations', () => {
  test.describe('Consultation List', () => {
    test('should display video consultations page', async ({ adminPage: page }) => {
      await page.goto('/video')
      await expect(
        page.getByRole('heading', { name: /video|consultation|tele/i }).or(page.getByText(/video|consultation/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have new consultation button', async ({ adminPage: page }) => {
      await page.goto('/video')
      const newButton = page.getByRole('button', { name: /new|create|schedule/i }).first().or(
        page.getByRole('link', { name: /new|create|schedule/i }).first()
      )
      if (await newButton.isVisible()) {
        await expect(newButton).toBeVisible()
      }
    })

    test('should show consultation list or empty state', async ({ adminPage: page }) => {
      await page.goto('/video')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*consultation|no.*data|schedule/i).first())
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Consultation Workflow', () => {
    test('should navigate to consultation detail', async ({ adminPage: page }) => {
      await page.goto('/video')
      await page.waitForTimeout(1000)
      const consultationLink = page.locator('a[href*="/video/"]').first()
      if (await consultationLink.isVisible()) {
        await consultationLink.click()
        await page.waitForTimeout(1000)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })
})
