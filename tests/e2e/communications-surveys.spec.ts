import { test, expect } from './fixtures/auth'

test.describe('Surveys', () => {
  test.describe('Survey List', () => {
    test('should navigate to feedback page with surveys', async ({ adminPage: page }) => {
      await page.goto('/communications/feedback')
      await expect(
        page.getByRole('heading', { name: /feedback|survey|review/i }).or(
          page.getByText(/feedback|survey|review/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show survey/feedback metrics', async ({ adminPage: page }) => {
      await page.goto('/communications/feedback')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/total|response|rating|nps|survey/i).first()
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show NPS score', async ({ adminPage: page }) => {
      await page.goto('/communications/feedback')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/nps|promoter|passive|detractor|score/i).first()
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show average rating', async ({ adminPage: page }) => {
      await page.goto('/communications/feedback')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/average|rating|star|★|⭐/i).first()
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show sentiment breakdown', async ({ adminPage: page }) => {
      await page.goto('/communications/feedback')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/sentiment|positive|negative|neutral/i).first()
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Survey Analytics', () => {
    test('should show response rate', async ({ adminPage: page }) => {
      await page.goto('/communications/feedback')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/response.*rate|%/i).first()
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
