import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

// Every page a clinic user can reach, captured full-page. Pages tagged @core
// are also captured on a phone and in dark mode (see playwright.visual.config).

// Static dashboard routes. `core` marks the ones also shot on mobile and dark.
const PAGES: { path: string; core?: boolean }[] = [
  { path: '/dashboard', core: true },
  { path: '/patients', core: true },
  { path: '/patients/new' },
  { path: '/appointments', core: true },
  { path: '/appointments/new' },
  { path: '/appointments/queue' },
  { path: '/appointments/waitlist' },
  { path: '/treatments', core: true },
  { path: '/treatments/new' },
  { path: '/treatments/plans' },
  { path: '/treatments/plans/new' },
  { path: '/prescriptions' },
  { path: '/prescriptions/new' },
  { path: '/medications' },
  { path: '/billing', core: true },
  { path: '/billing/invoices', core: true },
  { path: '/billing/invoices/new' },
  { path: '/billing/payments' },
  { path: '/billing/payment-plans' },
  { path: '/billing/payment-plans/new' },
  { path: '/billing/insurance' },
  { path: '/billing/insurance/providers' },
  { path: '/billing/insurance/pre-auth' },
  { path: '/billing/insurance/pre-auth/new' },
  { path: '/billing/reports' },
  { path: '/inventory', core: true },
  { path: '/inventory/new' },
  { path: '/inventory/suppliers' },
  { path: '/inventory/transactions' },
  { path: '/inventory/reports' },
  { path: '/lab' },
  { path: '/lab/orders/new' },
  { path: '/lab/vendors' },
  { path: '/sterilization' },
  { path: '/sterilization/instruments' },
  { path: '/sterilization/logs' },
  { path: '/sterilization/reports' },
  { path: '/staff', core: true },
  { path: '/staff/new' },
  { path: '/staff/attendance' },
  { path: '/staff/leaves' },
  { path: '/communications' },
  { path: '/communications/analytics' },
  { path: '/communications/automations' },
  { path: '/communications/feedback' },
  { path: '/crm' },
  { path: '/crm/loyalty' },
  { path: '/crm/memberships' },
  { path: '/crm/referrals' },
  { path: '/crm/segments' },
  { path: '/reports', core: true },
  { path: '/reports/audit-log' },
  { path: '/video' },
  { path: '/devices' },
  { path: '/chat' },
  { path: '/onboarding' },
  { path: '/settings', core: true },
  { path: '/settings/clinic' },
  { path: '/settings/profile' },
  { path: '/settings/appointments' },
  { path: '/settings/billing' },
  { path: '/settings/communications' },
  { path: '/settings/forms' },
  { path: '/settings/forms/new' },
  { path: '/settings/import' },
  { path: '/settings/integrations' },
  { path: '/settings/pricing' },
  { path: '/settings/procedures' },
  { path: '/settings/security' },
  { path: '/settings/setup-guide' },
  { path: '/settings/system' },
  { path: '/settings/ai' },
]

// Detail pages, opened on the first record the list API returns. (The seed has
// no treatments, so there is no treatment detail page to open.)
const DETAIL_PAGES: {
  name: string
  api: string
  key: string
  path: (id: string) => string
  core?: boolean
}[] = [
  {
    name: 'patient',
    api: '/api/patients?limit=1',
    key: 'patients',
    path: (id) => `/patients/${id}`,
    core: true,
  },
  {
    name: 'patient-edit',
    api: '/api/patients?limit=1',
    key: 'patients',
    path: (id) => `/patients/${id}/edit`,
  },
  {
    name: 'appointment',
    api: '/api/appointments?limit=1',
    key: 'appointments',
    path: (id) => `/appointments/${id}`,
  },
  {
    name: 'invoice',
    api: '/api/invoices?limit=1',
    key: 'invoices',
    path: (id) => `/billing/invoices/${id}`,
    core: true,
  },
  { name: 'staff-member', api: '/api/staff?limit=1', key: 'staff', path: (id) => `/staff/${id}` },
]

// Signed-out pages.
const PUBLIC_PAGES: { path: string; core?: boolean }[] = [
  { path: '/login', core: true },
  { path: '/signup' },
  { path: '/portal/login' },
  { path: '/pay/e2e-payment-link-token' }, // seeded by prisma/seed.ts
]

function snapshotName(path: string): string {
  return (path.replace(/^\//, '').replace(/[/?=&]+/g, '-') || 'home') + '.png'
}

async function capture(page: Page, path: string, name = snapshotName(path)) {
  const res = await page.goto(path, { waitUntil: 'load' })
  expect(res?.status(), `${path} should load`).toBeLessThan(400)
  // Client components fetch their data after hydration; let that settle. The
  // wait is bounded because Next.js keeps a prefetch of a link to a missing
  // page open, which would otherwise hold off "network idle" for good.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await showAllOfMain(page)
  await expect(page).toHaveScreenshot(name, { fullPage: true })
}

// The dashboard shell is screen-high and scrolls inside <main>, so a full-page
// shot would stop at the fold. Make the window tall enough for all of <main>,
// a few times over in case the content reflows at the new height.
async function showAllOfMain(page: Page) {
  for (let i = 0; i < 3; i++) {
    const hidden = await page.evaluate(() => {
      const main = document.querySelector('main')
      return main ? main.scrollHeight - main.clientHeight : 0
    })
    if (hidden <= 0) return
    const { width, height } = page.viewportSize()!
    await page.setViewportSize({ width, height: Math.min(height + hidden, 15_000) })
    // Let charts and other resize-observing components re-measure.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    )
    await page.waitForTimeout(250)
  }
}

async function firstId(request: APIRequestContext, api: string, key: string): Promise<string> {
  const res = await request.get(api)
  expect(res.ok(), `${api} should respond`).toBeTruthy()
  const list = (await res.json())[key] as { id: string }[]
  expect(
    list?.length,
    `${api} should return at least one record (is the database seeded?)`
  ).toBeGreaterThan(0)
  return list[0].id
}

test.describe('signed in', () => {
  for (const { path, core } of PAGES) {
    test(`${path}${core ? ' @core' : ''}`, async ({ page }) => {
      await capture(page, path)
    })
  }

  for (const { name, api, key, path, core } of DETAIL_PAGES) {
    test(`${name} detail${core ? ' @core' : ''}`, async ({ page, request }) => {
      await capture(page, path(await firstId(request, api, key)), `detail-${name}.png`)
    })
  }
})

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const { path, core } of PUBLIC_PAGES) {
    test(`${path}${core ? ' @core' : ''}`, async ({ page }) => {
      await capture(page, path, `public-${snapshotName(path)}`)
    })
  }
})
