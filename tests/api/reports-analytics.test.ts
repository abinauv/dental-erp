// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as analyticsGET } from '@/app/api/reports/analytics/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Auth helpers ─────────────────────────────────────────────────────────────

function mockAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
    hospitalId: 'h1',
  }
  vi.mocked(requireAuthAndRole).mockResolvedValue({ ...defaults, ...overrides } as any)
}

function mockAuthError() {
  vi.mocked(requireAuthAndRole).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  } as any)
}

function makeReq(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Auth & Dispatch
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/reports/analytics — auth & dispatch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await analyticsGET(makeReq('/api/reports/analytics'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid analytics type', async () => {
    mockAuth()
    const res = await analyticsGET(makeReq('/api/reports/analytics?type=invalid'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid analytics type')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. Patient Analytics
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/reports/analytics?type=patient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns patient analytics data', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findMany)
      .mockResolvedValueOnce([
        { id: 'p1', gender: 'MALE', dateOfBirth: new Date('1990-01-01'), referredBy: 'Google', createdAt: new Date() },
        { id: 'p2', gender: 'FEMALE', dateOfBirth: new Date('1985-06-15'), referredBy: null, createdAt: new Date() },
        { id: 'p3', gender: 'MALE', dateOfBirth: null, referredBy: 'Referral', createdAt: new Date() },
      ] as any) // patients in range
      .mockResolvedValueOnce([
        { id: 'p1', _count: { appointments: 3 } },
        { id: 'p2', _count: { appointments: 1 } },
        { id: 'p4', _count: { appointments: 5 } },
      ] as any) // patients with appointments

    const res = await analyticsGET(makeReq('/api/reports/analytics?type=patient&preset=this_month'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.newPatients).toBe(3)
    expect(body.demographics).toBeDefined()
    expect(body.demographics.male).toBe(2)
    expect(body.demographics.female).toBe(1)
    expect(body.ageGroups).toBeDefined()
    expect(body.acquisitionSources).toBeDefined()
    expect(body.retentionRate).toBeDefined()
  })

  it('handles empty patient data', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findMany).mockResolvedValue([])

    const res = await analyticsGET(makeReq('/api/reports/analytics?type=patient'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.newPatients).toBe(0)
    expect(body.returningPatients).toBe(0)
    expect(body.retentionRate).toBe(0)
    expect(body.demographics).toEqual({ male: 0, female: 0, other: 0 })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. Clinical Analytics
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/reports/analytics?type=clinical', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns clinical analytics data', async () => {
    mockAuth()
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    vi.mocked(prisma.treatment.findMany).mockResolvedValue([
      {
        id: 't1', status: 'COMPLETED', procedureId: 'proc1',
        startTime: oneHourAgo, endTime: now,
        procedure: { name: 'Root Canal', code: 'RC001', category: 'ENDODONTICS' },
      },
      {
        id: 't2', status: 'IN_PROGRESS', procedureId: 'proc1',
        startTime: null, endTime: null,
        procedure: { name: 'Root Canal', code: 'RC001', category: 'ENDODONTICS' },
      },
      {
        id: 't3', status: 'COMPLETED', procedureId: 'proc2',
        startTime: null, endTime: null,
        procedure: { name: 'Filling', code: 'FL001', category: 'RESTORATIVE' },
      },
    ] as any)

    const res = await analyticsGET(makeReq('/api/reports/analytics?type=clinical'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.totalTreatments).toBe(3)
    expect(body.completedTreatments).toBe(2)
    expect(body.inProgressTreatments).toBe(1)
    expect(body.completionRate).toBeCloseTo(66.67, 0)
    expect(body.commonProcedures).toBeDefined()
    expect(body.commonProcedures[0].name).toBe('Root Canal')
    expect(body.commonProcedures[0].count).toBe(2)
    expect(body.proceduresByCategory).toBeDefined()
  })

  it('handles no treatments', async () => {
    mockAuth()
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])

    const res = await analyticsGET(makeReq('/api/reports/analytics?type=clinical'))
    const body = await res.json()

    expect(body.totalTreatments).toBe(0)
    expect(body.completionRate).toBe(0)
    expect(body.avgTreatmentDuration).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. Financial Analytics
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/reports/analytics?type=financial', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns financial analytics data', async () => {
    mockAuth()
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      {
        id: 'inv1',
        totalAmount: 10000,
        paidAmount: 8000,
        balanceAmount: 2000,
        createdAt: new Date(),
        payments: [],
      },
      {
        id: 'inv2',
        totalAmount: 5000,
        paidAmount: 5000,
        balanceAmount: 0,
        createdAt: new Date(),
        payments: [],
      },
    ] as any)
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([
      { type: 'PURCHASE', totalPrice: 3000, createdAt: new Date() },
    ] as any)
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { paymentMethod: 'CASH', amount: 8000, paymentDate: new Date(), status: 'COMPLETED' },
      { paymentMethod: 'UPI', amount: 5000, paymentDate: new Date(), status: 'COMPLETED' },
    ] as any)

    const res = await analyticsGET(makeReq('/api/reports/analytics?type=financial'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.totalRevenue).toBe(15000)
    expect(body.totalExpenses).toBe(3000)
    expect(body.profitMargin).toBeCloseTo(80, 0)
    expect(body.avgBillValue).toBe(7500)
    expect(body.outstandingAmount).toBe(2000)
    expect(body.paymentMethodBreakdown).toBeDefined()
    expect(body.paymentMethodBreakdown).toHaveLength(2)
  })

  it('handles zero revenue', async () => {
    mockAuth()
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([])
    vi.mocked(prisma.payment.findMany).mockResolvedValue([])

    const res = await analyticsGET(makeReq('/api/reports/analytics?type=financial'))
    const body = await res.json()

    expect(body.totalRevenue).toBe(0)
    expect(body.profitMargin).toBe(0)
    expect(body.avgBillValue).toBe(0)
    expect(body.collectionEfficiency).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. Operational Analytics
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/reports/analytics?type=operational', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns operational analytics data', async () => {
    mockAuth()
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'a1', status: 'COMPLETED', doctorId: 'd1', waitTime: 10,
        doctor: { firstName: 'Dr', lastName: 'Smith', user: { role: 'DOCTOR' } },
      },
      {
        id: 'a2', status: 'CANCELLED', doctorId: 'd1', waitTime: null,
        doctor: { firstName: 'Dr', lastName: 'Smith', user: { role: 'DOCTOR' } },
      },
      {
        id: 'a3', status: 'NO_SHOW', doctorId: 'd1', waitTime: null,
        doctor: { firstName: 'Dr', lastName: 'Smith', user: { role: 'DOCTOR' } },
      },
    ] as any)
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([
      { doctorId: 'd1', status: 'COMPLETED', cost: 5000 },
    ] as any)
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([])
    vi.mocked(prisma.inventoryItem.aggregate).mockResolvedValue({ _sum: { currentStock: 100 } } as any)
    vi.mocked(prisma.inventoryItem.count).mockResolvedValue(5)

    const res = await analyticsGET(makeReq('/api/reports/analytics?type=operational'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.totalAppointments).toBe(3)
    expect(body.completedAppointments).toBe(1)
    expect(body.cancelledAppointments).toBe(1)
    expect(body.noShowCount).toBe(1)
    expect(body.noShowRate).toBeCloseTo(33.33, 0)
    expect(body.avgWaitTime).toBe(10)
    expect(body.staffProductivity).toBeDefined()
    expect(body.staffProductivity[0].appointmentsHandled).toBe(3)
  })

  it('handles no appointments', async () => {
    mockAuth()
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([])
    vi.mocked(prisma.inventoryItem.aggregate).mockResolvedValue({ _sum: { currentStock: 0 } } as any)
    vi.mocked(prisma.inventoryItem.count).mockResolvedValue(0)

    const res = await analyticsGET(makeReq('/api/reports/analytics?type=operational'))
    const body = await res.json()

    expect(body.totalAppointments).toBe(0)
    expect(body.noShowRate).toBe(0)
    expect(body.avgWaitTime).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. Date Range Presets
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/reports/analytics — date presets', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses custom date range when provided', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findMany).mockResolvedValue([])

    await analyticsGET(makeReq('/api/reports/analytics?type=patient&dateFrom=2026-01-01&dateTo=2026-01-31'))

    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31'),
          },
        }),
      })
    )
  })

  it('defaults to this_month preset', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findMany).mockResolvedValue([])

    await analyticsGET(makeReq('/api/reports/analytics?type=patient'))

    // Verify dates are in current month range
    const call = vi.mocked(prisma.patient.findMany).mock.calls[0][0]
    const dateFilter = call.where.createdAt
    expect(dateFilter.gte).toBeDefined()
    expect(dateFilter.lte).toBeDefined()
    expect(dateFilter.gte.getMonth()).toBe(new Date().getMonth())
  })
})
