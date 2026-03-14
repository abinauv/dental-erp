// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  GET as plansListGET,
  POST as plansListPOST,
} from '@/app/api/payment-plans/route'
import {
  GET as planDetailGET,
  PUT as planDetailPUT,
} from '@/app/api/payment-plans/[id]/route'
import { POST as planPayPOST } from '@/app/api/payment-plans/[id]/pay/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
    hospitalId: 'h1',
    session: { user: { id: 'u1', name: 'Admin', role: 'ADMIN' } },
  }
  vi.mocked(requireAuthAndRole).mockResolvedValue({ ...defaults, ...overrides } as any)
}

function mockAuthError() {
  vi.mocked(requireAuthAndRole).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  } as any)
}

function makeReq(path: string, method = 'GET', body?: any): NextRequest {
  const url = `http://localhost${path}`
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/payment-plans
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/payment-plans', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await plansListGET(makeReq('/api/payment-plans'))
    expect(res.status).toBe(401)
  })

  it('returns plans with summary', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([
      {
        id: 'pp1', totalAmount: 10000, downPayment: 2000, interestRate: 0,
        patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' },
        invoice: { id: 'inv1', invoiceNo: 'INV001', totalAmount: 10000 },
        schedules: [
          { installmentNo: 1, amount: 4000, status: 'PAID', paidAmount: 4000 },
          { installmentNo: 2, amount: 4000, status: 'PENDING', paidAmount: null },
        ],
      },
    ] as any)
    vi.mocked(prisma.paymentPlan.count)
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(1) // active
      .mockResolvedValueOnce(0) // completed
      .mockResolvedValueOnce(0) // defaulted
    vi.mocked(prisma.paymentPlanSchedule.aggregate).mockResolvedValue({
      _sum: { amount: 4000 },
    } as any)

    const res = await plansListGET(makeReq('/api/payment-plans'))
    const body = await res.json()

    expect(body.plans).toHaveLength(1)
    expect(body.plans[0].paidInstallments).toBe(1)
    expect(body.plans[0].overdueInstallments).toBe(0)
    expect(body.summary.active).toBe(1)
    expect(body.summary.totalOutstanding).toBe(4000)
  })

  it('filters by status', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([])
    vi.mocked(prisma.paymentPlan.count).mockResolvedValue(0)
    vi.mocked(prisma.paymentPlanSchedule.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any)

    await plansListGET(makeReq('/api/payment-plans?status=ACTIVE'))
    const call = vi.mocked(prisma.paymentPlan.findMany).mock.calls[0][0]
    expect(call.where.status).toBe('ACTIVE')
  })

  it('filters by patientId', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([])
    vi.mocked(prisma.paymentPlan.count).mockResolvedValue(0)
    vi.mocked(prisma.paymentPlanSchedule.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any)

    await plansListGET(makeReq('/api/payment-plans?patientId=p1'))
    const call = vi.mocked(prisma.paymentPlan.findMany).mock.calls[0][0]
    expect(call.where.patientId).toBe('p1')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/payment-plans
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/payment-plans', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await plansListPOST(makeReq('/api/payment-plans', 'POST', {
      invoiceId: 'inv1', installments: 3, startDate: '2026-03-01',
    }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for unauthorized roles', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'DOCTOR' } } })
    const res = await plansListPOST(makeReq('/api/payment-plans', 'POST', {
      invoiceId: 'inv1', installments: 3, startDate: '2026-03-01',
    }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await plansListPOST(makeReq('/api/payment-plans', 'POST', {}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when installments out of range', async () => {
    mockAuth()
    const res = await plansListPOST(makeReq('/api/payment-plans', 'POST', {
      invoiceId: 'inv1', installments: 1, startDate: '2026-03-01',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when invoice not found', async () => {
    mockAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null)
    const res = await plansListPOST(makeReq('/api/payment-plans', 'POST', {
      invoiceId: 'inv1', installments: 3, startDate: '2026-03-01',
    }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when invoice is already paid', async () => {
    mockAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1', status: 'PAID', balanceAmount: 0,
    } as any)
    const res = await plansListPOST(makeReq('/api/payment-plans', 'POST', {
      invoiceId: 'inv1', installments: 3, startDate: '2026-03-01',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when invoice already has active plan', async () => {
    mockAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1', status: 'PENDING', balanceAmount: 10000, patientId: 'p1',
    } as any)
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: 'pp1', status: 'ACTIVE',
    } as any)
    const res = await plansListPOST(makeReq('/api/payment-plans', 'POST', {
      invoiceId: 'inv1', installments: 3, startDate: '2026-03-01',
    }))
    expect(res.status).toBe(409)
  })

  it('creates payment plan with schedules', async () => {
    mockAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1', status: 'PENDING', balanceAmount: 9000, patientId: 'p1',
    } as any)
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null)

    const createdPlan = {
      id: 'pp1', invoiceId: 'inv1', totalAmount: 9000, installments: 3,
      schedules: [
        { installmentNo: 1, amount: 3000, dueDate: new Date('2026-03-01') },
        { installmentNo: 2, amount: 3000, dueDate: new Date('2026-04-01') },
        { installmentNo: 3, amount: 3000, dueDate: new Date('2026-05-01') },
      ],
      patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' },
      invoice: { id: 'inv1', invoiceNo: 'INV001' },
    }
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma))
    vi.mocked(prisma.paymentPlan.create).mockResolvedValue(createdPlan as any)

    const res = await plansListPOST(makeReq('/api/payment-plans', 'POST', {
      invoiceId: 'inv1', installments: 3, startDate: '2026-03-01',
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.schedules).toHaveLength(3)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/payment-plans/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/payment-plans/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await planDetailGET(makeReq('/api/payment-plans/pp1'), makeParams('pp1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when plan not found', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null)
    const res = await planDetailGET(makeReq('/api/payment-plans/pp1'), makeParams('pp1') as any)
    expect(res.status).toBe(404)
  })

  it('returns plan detail with schedules and payment info', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: 'pp1', totalAmount: 10000, downPayment: 2000, interestRate: 0,
      patient: { id: 'p1', firstName: 'John', lastName: 'Doe' },
      invoice: { id: 'inv1', invoiceNo: 'INV001', totalAmount: 10000, paidAmount: 6000, balanceAmount: 4000, status: 'PARTIALLY_PAID' },
      schedules: [
        { installmentNo: 1, amount: 4000, status: 'PAID', paidAmount: 4000, paymentId: 'pay1' },
        { installmentNo: 2, amount: 4000, status: 'PENDING', paidAmount: null, paymentId: null },
      ],
    } as any)
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: 'pay1', paymentNo: 'PAY00001', amount: 4000, paymentMethod: 'CASH' },
    ] as any)

    const res = await planDetailGET(makeReq('/api/payment-plans/pp1'), makeParams('pp1') as any)
    const body = await res.json()

    expect(body.paidInstallments).toBe(1)
    expect(body.overdueInstallments).toBe(0)
    expect(body.totalPaid).toBe(6000) // downPayment + paid installments
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. PUT /api/payment-plans/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/payment-plans/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await planDetailPUT(
      makeReq('/api/payment-plans/pp1', 'PUT', { action: 'cancel' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-ADMIN/ACCOUNTANT roles', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'RECEPTIONIST' } } })
    const res = await planDetailPUT(
      makeReq('/api/payment-plans/pp1', 'PUT', { action: 'cancel' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when plan not found', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null)
    const res = await planDetailPUT(
      makeReq('/api/payment-plans/pp1', 'PUT', { action: 'cancel' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('cancels active plan and waives pending installments', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: 'pp1', status: 'ACTIVE', schedules: [],
    } as any)
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined)

    const res = await planDetailPUT(
      makeReq('/api/payment-plans/pp1', 'PUT', { action: 'cancel' }),
      makeParams('pp1') as any,
    )
    const body = await res.json()
    expect(body.message).toContain('cancelled')
  })

  it('returns 400 when cancelling non-active plan', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: 'pp1', status: 'COMPLETED', schedules: [],
    } as any)
    const res = await planDetailPUT(
      makeReq('/api/payment-plans/pp1', 'PUT', { action: 'cancel' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(400)
  })

  it('waives an installment', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: 'pp1', status: 'ACTIVE', schedules: [],
    } as any)
    vi.mocked(prisma.paymentPlanSchedule.findFirst).mockResolvedValue({
      id: 'sch1', planId: 'pp1', status: 'PENDING',
    } as any)
    vi.mocked(prisma.paymentPlanSchedule.update).mockResolvedValue({ id: 'sch1', status: 'WAIVED' } as any)
    vi.mocked(prisma.paymentPlanSchedule.count).mockResolvedValue(1) // 1 remaining

    const res = await planDetailPUT(
      makeReq('/api/payment-plans/pp1', 'PUT', { action: 'waive', scheduleId: 'sch1' }),
      makeParams('pp1') as any,
    )
    const body = await res.json()
    expect(body.message).toContain('waived')
  })

  it('returns 400 when waiving already paid installment', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: 'pp1', status: 'ACTIVE', schedules: [],
    } as any)
    vi.mocked(prisma.paymentPlanSchedule.findFirst).mockResolvedValue({
      id: 'sch1', planId: 'pp1', status: 'PAID',
    } as any)

    const res = await planDetailPUT(
      makeReq('/api/payment-plans/pp1', 'PUT', { action: 'waive', scheduleId: 'sch1' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid action', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: 'pp1', status: 'ACTIVE', schedules: [],
    } as any)
    const res = await planDetailPUT(
      makeReq('/api/payment-plans/pp1', 'PUT', { action: 'invalid' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(400)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. POST /api/payment-plans/[id]/pay
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/payment-plans/[id]/pay', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await planPayPOST(
      makeReq('/api/payment-plans/pp1/pay', 'POST', { scheduleId: 'sch1' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for unauthorized roles', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'DOCTOR' } } })
    const res = await planPayPOST(
      makeReq('/api/payment-plans/pp1/pay', 'POST', { scheduleId: 'sch1' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(403)
  })

  it('returns 400 when scheduleId missing', async () => {
    mockAuth()
    const res = await planPayPOST(
      makeReq('/api/payment-plans/pp1/pay', 'POST', {}),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when active plan not found', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null)
    const res = await planPayPOST(
      makeReq('/api/payment-plans/pp1/pay', 'POST', { scheduleId: 'sch1' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 when installment not found', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: 'pp1', status: 'ACTIVE', invoiceId: 'inv1',
      invoice: { id: 'inv1', paidAmount: 0, totalAmount: 10000 },
    } as any)
    vi.mocked(prisma.paymentPlanSchedule.findFirst).mockResolvedValue(null)
    const res = await planPayPOST(
      makeReq('/api/payment-plans/pp1/pay', 'POST', { scheduleId: 'sch999' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when installment already paid', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: 'pp1', status: 'ACTIVE', invoiceId: 'inv1',
      invoice: { id: 'inv1', paidAmount: 4000, totalAmount: 10000 },
    } as any)
    vi.mocked(prisma.paymentPlanSchedule.findFirst).mockResolvedValue({
      id: 'sch1', planId: 'pp1', status: 'PAID',
    } as any)
    const res = await planPayPOST(
      makeReq('/api/payment-plans/pp1/pay', 'POST', { scheduleId: 'sch1' }),
      makeParams('pp1') as any,
    )
    expect(res.status).toBe(400)
  })

  it('records payment and updates invoice', async () => {
    mockAuth()
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: 'pp1', status: 'ACTIVE', invoiceId: 'inv1',
      invoice: { id: 'inv1', paidAmount: 2000, totalAmount: 10000, status: 'PARTIALLY_PAID' },
    } as any)
    vi.mocked(prisma.paymentPlanSchedule.findFirst).mockResolvedValue({
      id: 'sch1', planId: 'pp1', status: 'PENDING', amount: 4000, installmentNo: 1,
    } as any)
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      paymentNo: 'PAY00010',
    } as any)

    // Mock the $transaction to execute the callback
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma))
    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay1', paymentNo: 'PAY00011', amount: 4000,
    } as any)
    vi.mocked(prisma.paymentPlanSchedule.update).mockResolvedValue({} as any)
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as any)
    vi.mocked(prisma.paymentPlanSchedule.count).mockResolvedValue(1)
    vi.mocked(prisma.paymentPlanSchedule.findFirst).mockResolvedValueOnce({
      id: 'sch1', planId: 'pp1', status: 'PENDING', amount: 4000, installmentNo: 1,
    } as any).mockResolvedValueOnce({
      id: 'sch2', dueDate: new Date('2026-04-01'),
    } as any)
    vi.mocked(prisma.paymentPlan.update).mockResolvedValue({} as any)

    const res = await planPayPOST(
      makeReq('/api/payment-plans/pp1/pay', 'POST', {
        scheduleId: 'sch1',
        paymentMethod: 'UPI',
      }),
      makeParams('pp1') as any,
    )
    const body = await res.json()

    expect(body.message).toContain('4,000')
    expect(body.payment).toBeDefined()
  })
})
