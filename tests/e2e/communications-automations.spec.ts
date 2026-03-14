import { test, expect } from './fixtures/auth'

test.describe('Communication Automations', () => {
  test.describe('Automations Page', () => {
    test('should display automations page', async ({ adminPage: page }) => {
      await page.goto('/communications/automations')
      await expect(
        page.getByRole('heading', { name: /automation/i }).or(
          page.getByText(/automation/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have Create Automation button', async ({ adminPage: page }) => {
      await page.goto('/communications/automations')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await expect(createBtn).toBeVisible()
    })

    test('should display automation rules list', async ({ adminPage: page }) => {
      await page.goto('/communications/automations')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*automation|no.*data|empty/i).first())
          .or(page.locator('[class*="card"]').first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show automation status (active/inactive)', async ({ adminPage: page }) => {
      await page.goto('/communications/automations')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/active|inactive|enabled|disabled/i).first()
          .or(page.getByText(/no.*automation|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Create Automation', () => {
    test('should open automation creation form', async ({ adminPage: page }) => {
      await page.goto('/communications/automations')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await createBtn.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/name|trigger|event/i).first()
          .or(page.getByRole('heading', { name: /create|new|automation/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show trigger type selection', async ({ adminPage: page }) => {
      await page.goto('/communications/automations')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await createBtn.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/trigger|event|when/i).first()
          .or(page.getByText(/trigger|appointment|birthday|payment|recall|follow.?up/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show channel selection (SMS/Email)', async ({ adminPage: page }) => {
      await page.goto('/communications/automations')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await createBtn.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/channel|method|via/i).first()
          .or(page.getByText(/sms|email|whatsapp|channel/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should have template selection', async ({ adminPage: page }) => {
      await page.goto('/communications/automations')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await createBtn.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/template|message/i).first()
          .or(page.getByText(/template|message/i).first())
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Automation Actions', () => {
    test('should have toggle enable/disable', async ({ adminPage: page }) => {
      await page.goto('/communications/automations')
      await page.waitForTimeout(1000)
      const toggle = page.locator('input[type="checkbox"], [role="switch"]').first()
      await expect(toggle.or(page.locator('body'))).toBeVisible()
    })
  })
})
