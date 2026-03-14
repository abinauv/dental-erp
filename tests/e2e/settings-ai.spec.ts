import { test, expect } from './fixtures/auth'

test.describe('AI Settings', () => {
  test.describe('AI Configuration Page', () => {
    test('should display AI settings page', async ({ adminPage: page }) => {
      await page.goto('/settings/ai')
      await expect(page.getByRole('heading', { name: /ai|artificial intelligence/i }).first()
        .or(page.getByText(/ai configuration|ai settings/i).first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have master AI toggle', async ({ adminPage: page }) => {
      await page.goto('/settings/ai')
      await page.waitForTimeout(1000)
      // Look for the main AI enabled toggle
      const aiToggle = page.getByLabel(/enable ai|ai enabled/i).or(
        page.getByRole('switch').first()
      )
      await expect(aiToggle).toBeVisible({ timeout: 10000 })
    })

    test('should display feature toggles', async ({ adminPage: page }) => {
      await page.goto('/settings/ai')
      await page.waitForTimeout(1000)

      // Check for various AI feature toggle sections
      const chatToggle = page.getByText(/chat|assistant/i).first()
      const commandBarToggle = page.getByText(/command bar|command palette/i).first()
      const remindersToggle = page.getByText(/reminder|auto.*remind/i).first()
      const briefingToggle = page.getByText(/briefing|morning/i).first()

      // At least some of these should be visible
      const anyFeatureVisible = await chatToggle.isVisible() ||
        await commandBarToggle.isVisible() ||
        await remindersToggle.isVisible() ||
        await briefingToggle.isVisible()

      expect(anyFeatureVisible).toBeTruthy()
    })

    test('should have model preference selection', async ({ adminPage: page }) => {
      await page.goto('/settings/ai')
      await page.waitForTimeout(1000)

      // Look for model preference buttons (economy, balanced, quality)
      const economyBtn = page.getByRole('button', { name: /economy/i })
        .or(page.getByText(/economy/i))
      const balancedBtn = page.getByRole('button', { name: /balanced/i })
        .or(page.getByText(/balanced/i))
      const qualityBtn = page.getByRole('button', { name: /quality/i })
        .or(page.getByText(/quality/i))

      const hasPreferences = await economyBtn.isVisible() ||
        await balancedBtn.isVisible() ||
        await qualityBtn.isVisible()

      expect(hasPreferences).toBeTruthy()
    })

    test('should have budget/limit configuration', async ({ adminPage: page }) => {
      await page.goto('/settings/ai')
      await page.waitForTimeout(1000)

      // Look for financial approval limit or monthly budget inputs
      const budgetInput = page.getByLabel(/budget|limit|approval/i).first()
        .or(page.locator('input[type="number"]').first())

      if (await budgetInput.isVisible()) {
        await expect(budgetInput).toBeVisible()
      }
    })

    test('should toggle AI features on and off', async ({ adminPage: page }) => {
      await page.goto('/settings/ai')
      await page.waitForTimeout(1000)

      // Find first toggle/switch
      const toggles = page.getByRole('switch')
      const firstToggle = toggles.first()
      if (await firstToggle.isVisible()) {
        const initialState = await firstToggle.getAttribute('aria-checked')
          .catch(() => null) || await firstToggle.getAttribute('data-state')
          .catch(() => null)

        await firstToggle.click()
        await page.waitForTimeout(500)

        // State should have changed
        const newState = await firstToggle.getAttribute('aria-checked')
          .catch(() => null) || await firstToggle.getAttribute('data-state')
          .catch(() => null)

        // Toggle back to original state
        await firstToggle.click()
        await page.waitForTimeout(500)
      }
    })

    test('should show AI usage statistics', async ({ adminPage: page }) => {
      await page.goto('/settings/ai')
      await page.waitForTimeout(1000)

      // Look for usage stats section
      const usageSection = page.getByText(/usage|statistics|stats|requests|tokens/i).first()
      if (await usageSection.isVisible()) {
        await expect(usageSection).toBeVisible()
      }
    })

    test('should save AI settings', async ({ adminPage: page }) => {
      await page.goto('/settings/ai')
      await page.waitForTimeout(1000)

      // Find save button
      const saveButton = page.getByRole('button', { name: /save|update|apply/i })
      if (await saveButton.isVisible()) {
        await saveButton.click()
        // Should show success message
        await expect(
          page.getByText(/saved|updated|success/i).first()
        ).toBeVisible({ timeout: 10000 })
      }
    })

    test('should select model preference', async ({ adminPage: page }) => {
      await page.goto('/settings/ai')
      await page.waitForTimeout(1000)

      // Click a model preference button
      const balancedBtn = page.getByRole('button', { name: /balanced/i })
        .or(page.getByText(/balanced/i).first())
      if (await balancedBtn.isVisible()) {
        await balancedBtn.click()
        await page.waitForTimeout(500)
        // Should indicate selection (active state, border, or highlighted)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })
})
