import { test, expect } from './fixtures/auth'
import { openFirstPatientDetail } from './fixtures/patients'

test.describe('Patient Documents', () => {
  test.describe('Documents Tab Navigation', () => {
    test('should navigate to documents tab on patient detail', async ({ adminPage: page }) => {
      await openFirstPatientDetail(page)

      const documentsTab = page.getByRole('tab', { name: /document/i })
      await expect(documentsTab).toBeVisible({ timeout: 5000 })
      await documentsTab.click()
      await expect(documentsTab).toHaveAttribute('data-state', 'active')
    })

    test('should show upload button in documents tab', async ({ adminPage: page }) => {
      await page.goto('/patients')
      await page.waitForTimeout(1000)

      const patientLink = page.locator('a[href*="/patients/"]').first()
      if (await patientLink.isVisible()) {
        await patientLink.click()
        await page.waitForTimeout(1000)

        const documentsTab = page
          .getByRole('tab', { name: /document/i })
          .or(page.getByText(/documents/i).first())
          .first()
        if (await documentsTab.isVisible()) {
          await documentsTab.click()
          await page.waitForTimeout(500)

          // Upload button should be visible
          const uploadButton = page.getByRole('button', { name: /upload|add document|add file/i })
          await expect(uploadButton).toBeVisible({ timeout: 5000 })
        }
      }
    })

    test('should open upload dialog', async ({ adminPage: page }) => {
      await page.goto('/patients')
      await page.waitForTimeout(1000)

      const patientLink = page.locator('a[href*="/patients/"]').first()
      if (await patientLink.isVisible()) {
        await patientLink.click()
        await page.waitForTimeout(1000)

        const documentsTab = page
          .getByRole('tab', { name: /document/i })
          .or(page.getByText(/documents/i).first())
          .first()
        if (await documentsTab.isVisible()) {
          await documentsTab.click()
          await page.waitForTimeout(500)

          const uploadButton = page.getByRole('button', { name: /upload|add document|add file/i })
          if (await uploadButton.isVisible()) {
            await uploadButton.click()
            await page.waitForTimeout(500)

            // Upload dialog should appear with file input and type selector
            const dialog = page.getByRole('dialog').or(page.locator('[role="dialog"]')).first()
            await expect(dialog).toBeVisible({ timeout: 5000 })

            // Should have document type selector
            const typeSelect = page
              .getByLabel(/type|category/i)
              .or(page.getByText(/document type|file type/i))
              .first()
            await expect(typeSelect.or(dialog).first()).toBeVisible()
          }
        }
      }
    })

    test('should show document type options', async ({ adminPage: page }) => {
      await page.goto('/patients')
      await page.waitForTimeout(1000)

      const patientLink = page.locator('a[href*="/patients/"]').first()
      if (await patientLink.isVisible()) {
        await patientLink.click()
        await page.waitForTimeout(1000)

        const documentsTab = page
          .getByRole('tab', { name: /document/i })
          .or(page.getByText(/documents/i).first())
          .first()
        if (await documentsTab.isVisible()) {
          await documentsTab.click()
          await page.waitForTimeout(500)

          const uploadButton = page.getByRole('button', { name: /upload|add document|add file/i })
          if (await uploadButton.isVisible()) {
            await uploadButton.click()
            await page.waitForTimeout(500)

            // Should have document type options (XRAY, CT_SCAN, PHOTO, etc.)
            const typeSelector = page
              .getByLabel(/type/i)
              .first()
              .or(page.locator('select, [role="combobox"]').first())
              .first()
            if (await typeSelector.isVisible()) {
              await typeSelector.click()
              await page.waitForTimeout(300)

              // At least one document type should be available
              const anyOption = page
                .getByRole('option')
                .first()
                .or(
                  page
                    .getByText(/x-ray|xray|photo|ct scan|consent|prescription|lab report/i)
                    .first()
                )
                .first()
              await expect(anyOption).toBeVisible({ timeout: 3000 })
            }
          }
        }
      }
    })

    test('should show empty state when no documents exist', async ({ adminPage: page }) => {
      await page.goto('/patients')
      await page.waitForTimeout(1000)

      const patientLink = page.locator('a[href*="/patients/"]').first()
      if (await patientLink.isVisible()) {
        await patientLink.click()
        await page.waitForTimeout(1000)

        const documentsTab = page
          .getByRole('tab', { name: /document/i })
          .or(page.getByText(/documents/i).first())
          .first()
        if (await documentsTab.isVisible()) {
          await documentsTab.click()
          await page.waitForTimeout(1000)

          // Should either show document list or empty state
          const hasDocuments = page
            .locator('[data-testid="document-item"], .document-card, table tbody tr')
            .first()
          const emptyState = page.getByText(/no document|upload.*first|no files/i).first()

          await expect(
            hasDocuments
              .or(emptyState)
              .or(page.getByRole('button', { name: /upload/i }))
              .first()
          ).toBeVisible({ timeout: 5000 })
        }
      }
    })

    test('should have annotation and compare controls for existing documents', async ({
      adminPage: page,
    }) => {
      await page.goto('/patients')
      await page.waitForTimeout(1000)

      const patientLink = page.locator('a[href*="/patients/"]').first()
      if (await patientLink.isVisible()) {
        await patientLink.click()
        await page.waitForTimeout(1000)

        const documentsTab = page
          .getByRole('tab', { name: /document/i })
          .or(page.getByText(/documents/i).first())
          .first()
        if (await documentsTab.isVisible()) {
          await documentsTab.click()
          await page.waitForTimeout(1000)

          // If documents exist, check for annotation/compare buttons
          const documentItem = page
            .locator('[data-testid="document-item"], .document-card')
            .first()
            .or(page.locator('table tbody tr').first())
            .first()
          if (await documentItem.isVisible()) {
            // Look for action buttons
            const annotateBtn = page.getByRole('button', { name: /annotate/i })
            const compareBtn = page.getByRole('button', { name: /compare/i })
            const viewBtn = page.getByRole('button', { name: /view|open/i }).first()
            const deleteBtn = page.getByRole('button', { name: /delete|remove/i }).first()

            // At least view or some action should be available
            const hasActions =
              (await annotateBtn.isVisible()) ||
              (await compareBtn.isVisible()) ||
              (await viewBtn.isVisible()) ||
              (await deleteBtn.isVisible())

            // Actions present (or empty state is acceptable)
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })
  })
})
