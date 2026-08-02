import { Page, expect } from '@playwright/test'

/**
 * Open the first appointment's detail page from the appointments list.
 *
 * Rows in app/(dashboard)/appointments/page.tsx are not links — they navigate
 * via router.push() from a per-row dropdown, and the only <a> inside the table
 * is the "Book New Appointment" button in the empty state. Clicking blindly
 * therefore lands on the creation form rather than an appointment.
 */
export async function openFirstAppointmentDetail(page: Page) {
  await page.goto('/appointments')

  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 10000 })

  await firstRow.getByRole('button').last().click()
  await page.getByRole('menuitem', { name: /view details/i }).click()

  // Detail route is /appointments/<cuid>; exclude /appointments/new.
  await page.waitForURL(/\/appointments\/(?!new)[^/]+$/, { timeout: 10000 })
}
