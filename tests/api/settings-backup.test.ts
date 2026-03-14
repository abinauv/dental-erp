import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('date-fns', () => ({
  format: vi.fn(() => '2026-02-25-120000'),
}))

const backupModule = await import('@/app/api/settings/backup/route')

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/settings/backup')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return {
    url: url.toString(),
    nextUrl: { searchParams: url.searchParams },
  } as any
}

describe('Settings Backup API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
      user: { email: 'admin@test.com' },
    })
  })

  // ─── GET /api/settings/backup ─────────────────────────
  describe('GET /api/settings/backup', () => {
    it('exports full backup with all entity types', async () => {
      ;(prisma.patient.findMany as any).mockResolvedValue([{ id: 'p1', firstName: 'John' }])
      ;(prisma.appointment.findMany as any).mockResolvedValue([{ id: 'a1' }])
      ;(prisma.treatment.findMany as any).mockResolvedValue([{ id: 't1' }])
      ;(prisma.treatmentPlan.findMany as any).mockResolvedValue([])
      ;(prisma.invoice.findMany as any).mockResolvedValue([{ id: 'inv1' }])
      ;(prisma.payment.findMany as any).mockResolvedValue([])
      ;(prisma.inventoryItem.findMany as any).mockResolvedValue([])
      ;(prisma.stockTransaction.findMany as any).mockResolvedValue([])
      ;(prisma.setting.findMany as any).mockResolvedValue([])
      ;(prisma.hospital.findUnique as any).mockResolvedValue({ name: 'My Clinic' })
      ;(prisma.holiday.findMany as any).mockResolvedValue([])

      const res = await backupModule.GET(makeRequest())
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/json')
      expect(res.headers.get('Content-Disposition')).toContain('dental-erp-backup')

      const body = JSON.parse(await res.text())
      expect(body.version).toBe('1.0')
      expect(body.type).toBe('full')
      expect(body.data.patients).toHaveLength(1)
      expect(body.data.appointments).toHaveLength(1)
      expect(body.data.invoices).toHaveLength(1)
    })

    it('exports patients-only backup', async () => {
      ;(prisma.patient.findMany as any).mockResolvedValue([{ id: 'p1' }])

      const res = await backupModule.GET(makeRequest({ type: 'patients' }))
      expect(res.status).toBe(200)
      const body = JSON.parse(await res.text())
      expect(body.type).toBe('patients')
      expect(body.data.patients).toBeDefined()
      expect(body.data.appointments).toBeUndefined()
    })

    it('exports billing-only backup', async () => {
      ;(prisma.invoice.findMany as any).mockResolvedValue([{ id: 'inv1' }])
      ;(prisma.payment.findMany as any).mockResolvedValue([{ id: 'pay1' }])

      const res = await backupModule.GET(makeRequest({ type: 'billing' }))
      const body = JSON.parse(await res.text())
      expect(body.data.invoices).toBeDefined()
      expect(body.data.payments).toBeDefined()
      expect(body.data.patients).toBeUndefined()
    })

    it('exports settings-only backup', async () => {
      ;(prisma.setting.findMany as any).mockResolvedValue([])
      ;(prisma.hospital.findUnique as any).mockResolvedValue({ name: 'My Clinic' })
      ;(prisma.holiday.findMany as any).mockResolvedValue([])

      const res = await backupModule.GET(makeRequest({ type: 'settings' }))
      const body = JSON.parse(await res.text())
      expect(body.data.settings).toBeDefined()
      expect(body.data.clinicInfo).toBeDefined()
      expect(body.data.holidays).toBeDefined()
    })

    it('returns 401/403 for non-ADMIN', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Forbidden' }, { status: 403 }),
        hospitalId: null,
        session: null,
      })

      const res = await backupModule.GET(makeRequest())
      expect(res.status).toBe(403)
    })
  })

  // ─── POST /api/settings/backup ────────────────────────
  describe('POST /api/settings/backup', () => {
    it('returns entity counts', async () => {
      ;(prisma.patient.count as any).mockResolvedValue(50)
      ;(prisma.appointment.count as any).mockResolvedValue(200)
      ;(prisma.treatment.count as any).mockResolvedValue(100)
      ;(prisma.invoice.count as any).mockResolvedValue(80)
      ;(prisma.payment.count as any).mockResolvedValue(60)
      ;(prisma.inventoryItem.count as any).mockResolvedValue(30)
      ;(prisma.staff.count as any).mockResolvedValue(10)
      ;(prisma.labOrder.count as any).mockResolvedValue(25)

      const req = new Request('http://localhost/api/settings/backup', { method: 'POST' }) as any
      const res = await backupModule.POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data.patients).toBe(50)
      expect(body.data.appointments).toBe(200)
      expect(body.data.staff).toBe(10)
      expect(body.timestamp).toBeDefined()
    })

    it('returns 401/403 for non-ADMIN', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Forbidden' }, { status: 403 }),
        hospitalId: null,
        session: null,
      })

      const req = new Request('http://localhost/api/settings/backup', { method: 'POST' }) as any
      const res = await backupModule.POST(req)
      expect(res.status).toBe(403)
    })
  })
})
