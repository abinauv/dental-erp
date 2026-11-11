import { test, expect, type Page, type Locator } from '@playwright/test'

// Interactive states that full-page snapshots of pages at rest can't show:
// open menus, dialogs, selects, tooltips, toasts, keyboard focus and hover.
// Nothing here submits data; the one form submit is stopped by validation.
// Shot at the viewport, where overlays are positioned. @core ones also run on
// the phone and dark-mode projects.

async function open(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: 'load' })
  expect(res?.status(), `${path} should load`).toBeLessThan(400)
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
}

async function shot(page: Page, name: string, settle?: Locator) {
  if (settle) await expect(settle).toBeVisible()
  // Let enter animations and data inside the overlay settle.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
  await expect(page).toHaveScreenshot(name)
}

async function firstId(page: Page, api: string, key: string): Promise<string> {
  const res = await page.request.get(api)
  const list = (await res.json())[key] as { id: string }[]
  expect(list?.length, `${api} should return a record`).toBeGreaterThan(0)
  return list[0].id
}

test.describe('signed in', () => {
  test('user menu @core', async ({ page }) => {
    await open(page, '/dashboard')
    await page.getByRole('button').filter({ hasText: /^AU$/ }).click()
    await shot(page, 'menu-user.png', page.getByRole('menu'))
  })

  test('notifications menu', async ({ page }) => {
    await open(page, '/dashboard')
    await page.getByRole('button', { name: /notifications/i }).click()
    await shot(page, 'menu-notifications.png', page.getByRole('menu'))
  })

  test('theme menu', async ({ page }) => {
    await open(page, '/dashboard')
    await page.getByRole('button', { name: /theme/i }).click()
    await shot(page, 'menu-theme.png', page.getByRole('menu'))
  })

  test('global search dialog @core', async ({ page }) => {
    await open(page, '/dashboard')
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('/')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.type('Ra')
    await expect(dialog.getByText('Rahul Sharma').first()).toBeVisible()
    await shot(page, 'dialog-search.png')
  })

  test('form dialog @core', async ({ page }) => {
    await open(page, '/billing/insurance/providers')
    await page.getByRole('button', { name: /add/i }).first().click()
    await shot(page, 'dialog-provider.png', page.getByRole('dialog'))
  })

  test('payment dialog', async ({ page }) => {
    const id = await firstId(page, '/api/invoices?limit=1', 'invoices')
    await open(page, `/billing/invoices/${id}`)
    await page
      .getByRole('button', { name: /record payment/i })
      .first()
      .click()
    await shot(page, 'dialog-payment.png', page.getByRole('dialog'))
  })

  test('select open @core', async ({ page }) => {
    await open(page, '/patients/new')
    await page.getByRole('combobox').first().click()
    await shot(page, 'select-open.png', page.getByRole('listbox'))
  })

  test('toast', async ({ page }) => {
    await open(page, '/patients/new')
    // Skip the browser's own required-field check, so the empty form reaches
    // the page's check, which shows an error toast and saves nothing.
    await page.locator('form').evaluate((form) => ((form as HTMLFormElement).noValidate = true))
    await page.locator('form button[type=submit]').click()
    await shot(page, 'toast-error.png', page.locator('[data-swipe-direction][data-state=open]'))
  })

  test('tooltip', async ({ page }) => {
    await open(page, '/treatments/new')
    const trigger = page
      .locator(
        '[data-slot=tooltip-trigger], [data-state][aria-describedby], button:has(svg.lucide-mic)'
      )
      .first()
    await trigger.hover()
    await shot(page, 'tooltip.png', page.getByRole('tooltip'))
  })

  test('tab switch', async ({ page }) => {
    const id = await firstId(page, '/api/patients?limit=1', 'patients')
    await open(page, `/patients/${id}`)
    await page.getByRole('tab').nth(1).click()
    await shot(page, 'tabs-second.png', page.getByRole('tabpanel'))
  })

  test('row hover', async ({ page }) => {
    await open(page, '/patients')
    await page.locator('table tbody tr').first().hover()
    await shot(page, 'hover-row.png')
  })

  test('mobile sidebar @core', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the menu button only shows on small screens')
    await open(page, '/dashboard')
    await page.locator('header button').first().click()
    await shot(page, 'sidebar-mobile.png', page.getByRole('link', { name: /patients/i }).first())
  })
})

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('keyboard focus @core', async ({ page }) => {
    await open(page, '/login')
    await page.locator('input[type=email]').click()
    await shot(page, 'focus-input.png')
    // Tab on to the submit button, so its focus ring shows as for keyboard use.
    const submit = page.locator('button[type=submit]')
    for (let i = 0; i < 6 && !(await submit.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab')
    }
    await expect(submit).toBeFocused()
    await shot(page, 'focus-button.png')
  })
})
