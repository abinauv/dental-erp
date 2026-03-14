// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
  getAuthenticatedHospital: vi.fn(),
}))

vi.mock('@/lib/payment-gateways', () => ({
  getGateway: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as paymentsGET } from '@/app/api/payments/route'
import { POST as createOrderPOST } from '@/app/api/payments/create-order/route'

import { requireAuthAndRole, getAuthenticatedHospital } from '@/lib/api-helpers'
import { getGateway } from '@/lib/payment-gateways'
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

function mockHospitalAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
    hospitalId: 'h1',
  }
  vi.mocked(getAuthenticatedHospital).mockResolvedValue({ ...defaults, ...overrides } as any)
}

function mockAuthError() {
  vi.mocked(requireAuthAndRole).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  } as any)
}

function mockHospitalAuthError() {
  vi.mocked(getAuthenticatedHospital).mockResolvedValue({
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

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/payments
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/payments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await paymentsGET(makeReq('/api/payments'))
    expect(res.status).toBe(401)
  })

  it('returns payments with pagination and summary', async () => {
    mockAuth()
    const mockPayments = [
      {
        id: 'pay1',
        paymentNo: 'PAY001',
        amount: 5000,
        status: 'COMPLETED',
        invoice: {
          id: 'inv1',
          invoiceNo: 'INV001',
          totalAmount: 10000,
          patient: { id: 'p1', patientId: 'PT001', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        },
      },
    ]
    vi.mocked(prisma.payment.findMany).mockResolvedValue(mockPayments as any)
    vi.mocked(prisma.payment.count).mockResolvedValue(1)
    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 50000 } } as any)
      .mockResolvedValueOnce({ _sum: { refundAmount: 2000 } } as any)

    const res = await paymentsGET(makeReq('/api/payments'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.payments).toHaveLength(1)
    expect(body.summary.totalReceived).toBe(50000)
    expect(body.summary.totalRefunded).toBe(2000)
    expect(body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    })
  })

  it('applies search filter', async () => {
    mockAuth()
    vi.mocked(prisma.payment.findMany).mockResolvedValue([])
    vi.mocked(prisma.payment.count).mockResolvedValue(0)
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: null } } as any)

    await paymentsGET(makeReq('/api/payments?search=PAY001'))

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { paymentNo: { contains: 'PAY001' } },
          ]),
        }),
      })
    )
  })

  it('applies status and payment method filters', async () => {
    mockAuth()
    vi.mocked(prisma.payment.findMany).mockResolvedValue([])
    vi.mocked(prisma.payment.count).mockResolvedValue(0)
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: null } } as any)

    await paymentsGET(makeReq('/api/payments?status=COMPLETED&paymentMethod=RAZORPAY'))

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'COMPLETED',
          paymentMethod: 'RAZORPAY',
        }),
      })
    )
  })

  it('applies date range filters', async () => {
    mockAuth()
    vi.mocked(prisma.payment.findMany).mockResolvedValue([])
    vi.mocked(prisma.payment.count).mockResolvedValue(0)
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: null } } as any)

    await paymentsGET(makeReq('/api/payments?dateFrom=2026-01-01&dateTo=2026-01-31'))

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    )
  })

  it('applies pagination correctly', async () => {
    mockAuth()
    vi.mocked(prisma.payment.findMany).mockResolvedValue([])
    vi.mocked(prisma.payment.count).mockResolvedValue(100)
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: null } } as any)

    const res = await paymentsGET(makeReq('/api/payments?page=3&limit=20'))
    const body = await res.json()

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 20,
      })
    )
    expect(body.pagination.totalPages).toBe(5)
  })

  it('handles null summary amounts', async () => {
    mockAuth()
    vi.mocked(prisma.payment.findMany).mockResolvedValue([])
    vi.mocked(prisma.payment.count).mockResolvedValue(0)
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: null, refundAmount: null } } as any)

    const res = await paymentsGET(makeReq('/api/payments'))
    const body = await res.json()

    expect(body.summary.totalReceived).toBe(0)
    expect(body.summary.totalRefunded).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/payments/create-order
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/payments/create-order', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockHospitalAuthError()
    const res = await createOrderPOST(makeReq('/api/payments/create-order', 'POST', { invoiceId: 'inv1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when invoiceId is missing', async () => {
    mockHospitalAuth()
    const res = await createOrderPOST(makeReq('/api/payments/create-order', 'POST', {}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('invoiceId')
  })

  it('returns 404 when invoice not found', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null)

    const res = await createOrderPOST(makeReq('/api/payments/create-order', 'POST', {
      invoiceId: 'inv-nonexistent',
    }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Invoice not found')
  })

  it('returns 400 when invoice is fully paid', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1',
      balanceAmount: 0,
      patient: { firstName: 'John', lastName: 'Doe', email: 'j@test.com', phone: '9876543210' },
      hospital: { name: 'Test Clinic' },
    } as any)

    const res = await createOrderPOST(makeReq('/api/payments/create-order', 'POST', {
      invoiceId: 'inv1',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('fully paid')
  })

  it('returns 400 when payment gateway is not configured', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1',
      invoiceNo: 'INV001',
      balanceAmount: 5000,
      totalAmount: 10000,
      patient: { firstName: 'John', lastName: 'Doe', email: 'j@test.com', phone: '9876543210' },
      hospital: { name: 'Test Clinic' },
    } as any)
    vi.mocked(getGateway).mockResolvedValue(null)

    const res = await createOrderPOST(makeReq('/api/payments/create-order', 'POST', {
      invoiceId: 'inv1',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('not configured')
  })

  it('creates payment order successfully', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1',
      invoiceNo: 'INV001',
      balanceAmount: 5000,
      totalAmount: 10000,
      patient: { firstName: 'John', lastName: 'Doe', email: 'j@test.com', phone: '9876543210' },
      hospital: { name: 'Test Clinic' },
    } as any)

    const mockGateway = {
      createOrder: vi.fn().mockResolvedValue({
        orderId: 'order_123',
        provider: 'razorpay',
      }),
      getCheckoutConfig: vi.fn().mockReturnValue({
        key: 'rzp_test_key',
        name: 'Test Clinic',
      }),
    }
    vi.mocked(getGateway).mockResolvedValue({
      gateway: mockGateway,
      credentials: { keyId: 'rzp_test_key' },
    } as any)

    const res = await createOrderPOST(makeReq('/api/payments/create-order', 'POST', {
      invoiceId: 'inv1',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.order.orderId).toBe('order_123')
    expect(body.order.amount).toBe(5000)
    expect(body.hospital.name).toBe('Test Clinic')
    expect(body.patient.name).toBe('John Doe')
    expect(body.invoice.balanceAmount).toBe(5000)
  })

  it('caps payment amount to balance', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1',
      invoiceNo: 'INV001',
      balanceAmount: 3000,
      totalAmount: 10000,
      patient: { firstName: 'John', lastName: 'Doe', email: null, phone: '9876543210' },
      hospital: { name: 'Test' },
    } as any)

    const mockGateway = {
      createOrder: vi.fn().mockResolvedValue({ orderId: 'o1', provider: 'razorpay' }),
      getCheckoutConfig: vi.fn().mockReturnValue({}),
    }
    vi.mocked(getGateway).mockResolvedValue({ gateway: mockGateway, credentials: {} } as any)

    const res = await createOrderPOST(makeReq('/api/payments/create-order', 'POST', {
      invoiceId: 'inv1',
      amount: 9999, // more than balance
    }))
    const body = await res.json()

    expect(body.order.amount).toBe(3000) // capped to balance
    expect(mockGateway.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3000 })
    )
  })
})
