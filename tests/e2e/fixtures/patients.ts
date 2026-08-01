import { Page, expect } from '@playwright/test'

/**
 * Open the first patient's detail page from the patients list.
 *
 * Rows in app/(dashboard)/patients/page.tsx are not links — they navigate via
 * router.push() from a per-row dropdown. The only <a href*="/patients/"> on
 * that page is the "Add Patient" button (/patients/new), so the older
 * `locator('a[href*="/patients/"]').first()` approach landed on the creation
 * form instead of a patient, where none of the detail tabs exist.
 */
export async function openFirstPatientDetail(page: Page) {
  await page.goto('/patients')

  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 10000 })

  await firstRow.getByRole('button').last().click()
  await page.getByRole('menuitem', { name: /view details/i }).click()

  // Detail route is /patients/<cuid>; exclude /patients/new.
  await page.waitForURL(/\/patients\/(?!new)[^/]+$/, { timeout: 10000 })
}
