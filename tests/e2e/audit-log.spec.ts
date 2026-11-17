import { test, expect } from './fixtures/auth'

// Reports → Audit Log records changes to clinic records (lib/audit-log.ts) and
// sign-ins, through the running app: the signed-in user is attached to the
// change by the API's authentication, not by the route.
test.describe('Audit log', () => {
  test('shows who changed a patient, and the old and new value', async ({ adminPage: page }) => {
    const list = await page.request.get('/api/patients?limit=1')
    expect(list.ok()).toBeTruthy()
    const [patient] = (await list.json()).patients
    const occupation = `Audit check ${Date.now()}`

    const saved = await page.request.put(`/api/patients/${patient.id}`, { data: { occupation } })
    expect(saved.ok()).toBeTruthy()

    await page.goto('/reports/audit-log')
    await page.getByPlaceholder(/search/i).fill(occupation)
    const change = page.getByText(new RegExp(`^Occupation: .+ → ${occupation}$`))
    await expect(change).toBeVisible({ timeout: 15000 })

    const entry = page.locator('div.flex.items-start').filter({ has: change })
    await expect(entry.getByText('Admin User')).toBeVisible()
    await expect(entry.getByText(`${patient.firstName} ${patient.lastName}`)).toBeVisible()
    await expect(entry.getByText('Update')).toBeVisible()
  })

  test('records sign-ins', async ({ adminPage: page }) => {
    const response = await page.request.get('/api/audit-log?action=LOGIN&q=Admin%20User&limit=5')
    expect(response.ok()).toBeTruthy()
    const { data } = await response.json()
    expect(data.length).toBeGreaterThan(0)
    expect(data[0]).toMatchObject({ action: 'LOGIN', entityType: 'User', source: 'web' })
    expect(data[0].user.name).toBe('Admin User')
  })

  test('is for admins only', async ({ doctorPage: page }) => {
    const response = await page.request.get('/api/audit-log')
    expect(response.status()).toBe(403)
  })
})
