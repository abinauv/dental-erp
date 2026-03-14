import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockBillingUtils = vi.hoisted(() => ({
  getDateRangeFromPreset: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/billing-utils', () => mockBillingUtils)

const reportsModule = await import('@/app/api/billing/reports/route')
const unbilledModule = await import('@/app/api/billing/unbilled-treatments/route')

function makeReportsRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/billing/reports')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString()) as any
}

function makeUnbilledRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/billing/unbilled-treatments')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString()) as any
}

describe('Billing Reports & Unbilled Treatments API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
    mockBillingUtils.getDateRangeFromPreset.mockReturnValue({
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-28'),
    })
  })

  // ─── GET /api/billing/reports (summary) ───────────
  describe('GET /api/billing/reports', () => {
    it('returns summary report with breakdowns', async () => {
      ;(prisma.invoice.aggregate as any)
        .mockResolvedValueOnce({ _sum: { totalAmount: 50000, discountAmount: 2000 }, _count: 20 })
        .mockResolvedValueOnce({ _sum: { balanceAmount: 10000 }, _count: 5 })
      ;(prisma.payment.aggregate as any).mockResolvedValue({
        _sum: { amount: 40000 },
        _count: 18,
      })
      ;(prisma.insuranceClaim.aggregate as any).mockResolvedValue({
        _sum: { claimAmount: 15000, settledAmount: 12000 },
        _count: 3,
      })
      ;(prisma.payment.groupBy as any).mockResolvedValue([
        { paymentMethod: 'CASH', _sum: { amount: 20000 }, _count: 10 },
        { paymentMethod: 'UPI', _sum: { amount: 20000 }, _count: 8 },
      ])
      ;(prisma.invoice.groupBy as any).mockResolvedValue([
        { status: 'PAID', _sum: { totalAmount: 40000 }, _count: 15 },
        { status: 'PENDING', _sum: { totalAmount: 10000 }, _count: 5 },
      ])

      const res = await reportsModule.GET(makeReportsRequest({ type: 'summary' }))
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.summary.totalBilled).toBe(50000)
      expect(body.summary.totalCollected).toBe(40000)
      expect(body.summary.totalOutstanding).toBe(10000)
      expect(body.summary.insuranceClaimed).toBe(15000)
      expect(body.breakdowns.byPaymentMethod).toHaveLength(2)
      expect(body.breakdowns.byInvoiceStatus).toHaveLength(2)
    })

    it('returns revenue report with daily data', async () => {
      const date1 = new Date('2026-02-10T10:00:00Z')
      const date2 = new Date('2026-02-10T14:00:00Z')
      const date3 = new Date('2026-02-11T09:00:00Z')

      ;(prisma.invoice.findMany as any).mockResolvedValue([
        { createdAt: date1, totalAmount: 1000, paidAmount: 800, discountAmount: 100, cgstAmount: 50, sgstAmount: 50 },
        { createdAt: date2, totalAmount: 2000, paidAmount: 2000, discountAmount: 0, cgstAmount: 100, sgstAmount: 100 },
        { createdAt: date3, totalAmount: 500, paidAmount: 500, discountAmount: 50, cgstAmount: 25, sgstAmount: 25 },
      ])

      const res = await reportsModule.GET(makeReportsRequest({ type: 'revenue' }))
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.dailyData).toHaveLength(2) // 2 distinct dates
      expect(body.totals.totalBilled).toBe(3500)
      expect(body.totals.invoiceCount).toBe(3)
    })

    it('returns outstanding report with aging buckets', async () => {
      const today = new Date()
      const daysAgo = (n: number) => {
        const d = new Date(today)
        d.setDate(d.getDate() - n)
        return d
      }

      ;(prisma.invoice.findMany as any).mockResolvedValue([
        { id: 'i1', balanceAmount: 5000, dueDate: daysAgo(0), createdAt: new Date(), patient: { id: 'p1' } },
        { id: 'i2', balanceAmount: 3000, dueDate: daysAgo(15), createdAt: new Date(), patient: { id: 'p2' } },
        { id: 'i3', balanceAmount: 2000, dueDate: daysAgo(45), createdAt: new Date(), patient: { id: 'p3' } },
        { id: 'i4', balanceAmount: 1000, dueDate: daysAgo(100), createdAt: new Date(), patient: { id: 'p4' } },
      ])

      const res = await reportsModule.GET(makeReportsRequest({ type: 'outstanding' }))
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.totals.totalOutstanding).toBe(11000)
      expect(body.totals.invoiceCount).toBe(4)
      expect(body.aging).toBeDefined()
    })

    it('returns 400 for invalid report type', async () => {
      const res = await reportsModule.GET(makeReportsRequest({ type: 'invalid_type' }))
      expect(res.status).toBe(400)
    })

    it('returns 403 for non-ADMIN/ACCOUNTANT roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'DOCTOR' } },
      })

      const res = await reportsModule.GET(makeReportsRequest())
      expect(res.status).toBe(403)
    })

    it('uses custom date range when provided', async () => {
      ;(prisma.invoice.aggregate as any).mockResolvedValue({ _sum: { totalAmount: 0, discountAmount: 0 }, _count: 0 })
      ;(prisma.payment.aggregate as any).mockResolvedValue({ _sum: { amount: 0 }, _count: 0 })
      ;(prisma.insuranceClaim.aggregate as any).mockResolvedValue({ _sum: { claimAmount: 0, settledAmount: 0 }, _count: 0 })
      ;(prisma.payment.groupBy as any).mockResolvedValue([])
      ;(prisma.invoice.groupBy as any).mockResolvedValue([])

      const res = await reportsModule.GET(
        makeReportsRequest({ type: 'summary', dateFrom: '2026-01-01', dateTo: '2026-01-31' })
      )
      expect(res.status).toBe(200)
      // Should NOT call getDateRangeFromPreset when custom dates given
      expect(mockBillingUtils.getDateRangeFromPreset).not.toHaveBeenCalled()
    })
  })

  // ─── GET /api/billing/unbilled-treatments ─────────
  describe('GET /api/billing/unbilled-treatments', () => {
    it('returns unbilled treatments for a patient', async () => {
      ;(prisma.patient.findUnique as any).mockResolvedValue({
        id: 'p1',
        patientId: 'PAT001',
        firstName: 'John',
        lastName: 'Doe',
      })
      ;(prisma.treatment.findMany as any).mockResolvedValue([
        {
          id: 't1',
          treatmentNo: 'TRT001',
          cost: 3000,
          toothNumbers: '11,12',
          endTime: new Date(),
          procedure: { id: 'proc1', code: 'RST001', name: 'Filling', category: 'RESTORATIVE', basePrice: 2500 },
          doctor: { id: 'd1', firstName: 'Jane', lastName: 'Smith' },
        },
        {
          id: 't2',
          treatmentNo: 'TRT002',
          cost: null,
          toothNumbers: null,
          endTime: null,
          procedure: { id: 'proc2', code: 'END001', name: 'Root Canal', category: 'ENDODONTIC', basePrice: 5000 },
          doctor: null,
        },
      ])

      const res = await unbilledModule.GET(makeUnbilledRequest({ patientId: 'p1' }))
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.patient.firstName).toBe('John')
      expect(body.treatments).toHaveLength(2)
      expect(body.treatments[0].unitPrice).toBe(3000)
      expect(body.treatments[0].doctor).toBe('Dr. Jane Smith')
      expect(body.treatments[1].unitPrice).toBe(5000) // falls back to basePrice
      expect(body.summary.totalTreatments).toBe(2)
      expect(body.summary.totalUnbilled).toBe(8000)
    })

    it('returns 400 when patientId missing', async () => {
      const res = await unbilledModule.GET(makeUnbilledRequest())
      expect(res.status).toBe(400)
    })

    it('returns 404 when patient not found', async () => {
      ;(prisma.patient.findUnique as any).mockResolvedValue(null)

      const res = await unbilledModule.GET(makeUnbilledRequest({ patientId: 'p999' }))
      expect(res.status).toBe(404)
    })

    it('returns empty when no unbilled treatments', async () => {
      ;(prisma.patient.findUnique as any).mockResolvedValue({ id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' })
      ;(prisma.treatment.findMany as any).mockResolvedValue([])

      const res = await unbilledModule.GET(makeUnbilledRequest({ patientId: 'p1' }))
      const body = await res.json()
      expect(body.treatments).toHaveLength(0)
      expect(body.summary.totalUnbilled).toBe(0)
    })
  })
})
