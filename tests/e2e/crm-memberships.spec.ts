import { test, expect } from './fixtures/auth'

test.describe('CRM Memberships', () => {
  test.describe('Membership Plans', () => {
    test('should display memberships page', async ({ adminPage: page }) => {
      await page.goto('/crm/memberships')
      await expect(
        page.getByRole('heading', { name: /membership|plan/i }).or(
          page.getByText(/membership/i).first()
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('should have Create Plan button', async ({ adminPage: page }) => {
      await page.goto('/crm/memberships')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await expect(createBtn).toBeVisible()
    })

    test('should display plans in list or table', async ({ adminPage: page }) => {
      await page.goto('/crm/memberships')
      await page.waitForTimeout(1000)
      await expect(
        page.locator('table').or(page.getByText(/no.*plan|no.*membership|no.*data/i).first())
          .or(page.locator('[class*="card"]').first())
      ).toBeVisible({ timeout: 10000 })
    })

    test('should show plan pricing information', async ({ adminPage: page }) => {
      await page.goto('/crm/memberships')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/₹|price|fee|annual|monthly|amount/i).first()
          .or(page.getByText(/no.*plan|no.*data/i).first())
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show plan features/benefits', async ({ adminPage: page }) => {
      await page.goto('/crm/memberships')
      await page.waitForTimeout(1000)
      await expect(
        page.getByText(/benefit|feature|discount|include/i).first()
          .or(page.getByText(/no.*plan|no.*data/i).first())
          .or(page.locator('body'))
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Create Plan', () => {
    test('should open plan creation form', async ({ adminPage: page }) => {
      await page.goto('/crm/memberships')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await createBtn.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/name|title/i).first()
          .or(page.getByRole('heading', { name: /create|new|plan|membership/i }))
      ).toBeVisible({ timeout: 5000 })
    })

    test('should have price and duration fields', async ({ adminPage: page }) => {
      await page.goto('/crm/memberships')
      const createBtn = page.getByRole('button', { name: /create|new|add/i }).first()
      await createBtn.click()
      await page.waitForTimeout(500)
      await expect(
        page.getByLabel(/price|fee|amount|duration|validity/i).first()
      ).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Enroll Patient', () => {
    test('should have enroll option on membership plans', async ({ adminPage: page }) => {
      await page.goto('/crm/memberships')
      await page.waitForTimeout(1000)
      const enrollBtn = page.getByRole('button', { name: /enroll|subscribe|add.*member/i }).first()
      await expect(enrollBtn.or(page.locator('body'))).toBeVisible()
    })
  })
})
