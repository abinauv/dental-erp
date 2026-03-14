// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

const { mockGetGateway } = vi.hoisted(() => ({
  mockGetGateway: vi.fn(),
}))

vi.mock('@/lib/payment-gateways', () => ({
  getGateway: mockGetGateway,
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as publicSlotsGET } from '@/app/api/public/[slug]/slots/route'
import { POST as publicOrderPOST } from '@/app/api/payments/public-order/route'
import { POST as publicVerifyPOST } from '@/app/api/payments/public-verify/route'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(path: string, method = 'GET', body?: any): NextRequest {
  const url = `http://localhost${path}`
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init)
}

function makeParams(slug: string) {
  return { params: Promise.resolve({ slug }) }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/public/[slug]/slots
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/public/[slug]/slots', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when doctorId or date missing', async () => {
    const res = await publicSlotsGET(makeReq('/api/public/test/slots'), makeParams('test'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when clinic not found', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue(null)

    const res = await publicSlotsGET(
      makeReq('/api/public/test/slots?doctorId=d1&date=2026-03-15'),
      makeParams('test')
    )
    expect(res.status).toBe(404)
  })

  it('returns 403 when portal not enabled', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1', workingHours: null, patientPortalEnabled: false,
    } as any)

    const res = await publicSlotsGET(
      makeReq('/api/public/test/slots?doctorId=d1&date=2026-03-15'),
      makeParams('test')
    )
    expect(res.status).toBe(403)
  })

  it('returns no slots on a holiday', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1', workingHours: null, patientPortalEnabled: true,
    } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue({
      name: 'Republic Day',
    } as any)

    const res = await publicSlotsGET(
      makeReq('/api/public/test/slots?doctorId=d1&date=2026-01-26'),
      makeParams('test')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.available).toBe(false)
    expect(body.reason).toContain('Republic Day')
    expect(body.slots).toHaveLength(0)
  })

  it('returns 404 when doctor not found', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1', workingHours: null, patientPortalEnabled: true,
    } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null)

    const res = await publicSlotsGET(
      makeReq('/api/public/test/slots?doctorId=d-none&date=2026-03-15'),
      makeParams('test')
    )
    expect(res.status).toBe(404)
  })

  it('returns available slots with booked ones marked unavailable', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1', workingHours: JSON.stringify({
        start: '09:00', end: '12:00', lunchStart: '13:00', lunchEnd: '14:00',
      }),
      patientPortalEnabled: true,
    } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.staffShift.findUnique).mockResolvedValue(null) // no shift, uses working hours
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { scheduledTime: '10:00', duration: 30 },
    ] as any)

    const res = await publicSlotsGET(
      makeReq('/api/public/test/slots?doctorId=d1&date=2026-03-15'),
      makeParams('test')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.available).toBe(true)
    expect(body.slots.length).toBeGreaterThan(0)

    // 10:00 should be booked
    const bookedSlot = body.slots.find((s: any) => s.time === '10:00')
    expect(bookedSlot.available).toBe(false)

    // 09:00 should be available
    const freeSlot = body.slots.find((s: any) => s.time === '09:00')
    expect(freeSlot.available).toBe(true)
  })

  it('uses doctor shift hours when available', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1', workingHours: null, patientPortalEnabled: true,
    } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.staffShift.findUnique).mockResolvedValue({
      startTime: '10:00', endTime: '11:00',
    } as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])

    const res = await publicSlotsGET(
      makeReq('/api/public/test/slots?doctorId=d1&date=2026-03-15'),
      makeParams('test')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // With 10:00-11:00 shift, should only have 10:00 and 10:30 slots
    expect(body.slots).toHaveLength(2)
    expect(body.slots[0].time).toBe('10:00')
    expect(body.slots[1].time).toBe('10:30')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/payments/public-order
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/payments/public-order', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when token missing', async () => {
    const res = await publicOrderPOST(makeReq('/api/payments/public-order', 'POST', {}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when payment link not found', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue(null)

    const res = await publicOrderPOST(makeReq('/api/payments/public-order', 'POST', { token: 'bad-token' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when link already used', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue({
      id: 'pl1', usedAt: new Date(), expiresAt: new Date(Date.now() + 86400000),
      invoice: { balanceAmount: 5000 },
    } as any)

    const res = await publicOrderPOST(makeReq('/api/payments/public-order', 'POST', { token: 'used-token' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('already been used')
  })

  it('returns 400 when link expired', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue({
      id: 'pl1', usedAt: null, expiresAt: new Date(Date.now() - 86400000), // expired yesterday
      invoice: { balanceAmount: 5000 },
    } as any)

    const res = await publicOrderPOST(makeReq('/api/payments/public-order', 'POST', { token: 'expired-token' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('expired')
  })

  it('returns 400 when invoice already paid', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue({
      id: 'pl1', usedAt: null, expiresAt: new Date(Date.now() + 86400000),
      invoice: { balanceAmount: 0 },
    } as any)

    const res = await publicOrderPOST(makeReq('/api/payments/public-order', 'POST', { token: 'paid-token' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('already paid')
  })

  it('returns 400 when gateway not configured', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue({
      id: 'pl1', usedAt: null, expiresAt: new Date(Date.now() + 86400000),
      hospitalId: 'h1',
      invoice: {
        id: 'inv1', invoiceNo: 'INV001', balanceAmount: 3000,
        patient: { firstName: 'John', lastName: 'Doe', email: 'j@d.com', phone: '1234567890' },
        hospital: { name: 'Clinic' },
      },
    } as any)
    mockGetGateway.mockResolvedValue(null)

    const res = await publicOrderPOST(makeReq('/api/payments/public-order', 'POST', { token: 'valid-token' }))
    expect(res.status).toBe(400)
  })

  it('creates order successfully', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue({
      id: 'pl1', usedAt: null, expiresAt: new Date(Date.now() + 86400000),
      hospitalId: 'h1', amount: 3000,
      invoice: {
        id: 'inv1', invoiceNo: 'INV001', balanceAmount: 3000,
        patient: { firstName: 'John', lastName: 'Doe', email: 'j@d.com', phone: '1234567890' },
        hospital: { name: 'Clinic' },
      },
    } as any)
    mockGetGateway.mockResolvedValue({
      gateway: {
        createOrder: vi.fn().mockResolvedValue({
          orderId: 'order_123', provider: 'RAZORPAY',
        }),
        getCheckoutConfig: vi.fn().mockReturnValue({ key: 'rzp_key' }),
      },
      credentials: { provider: 'RAZORPAY' },
    })

    const res = await publicOrderPOST(makeReq('/api/payments/public-order', 'POST', { token: 'valid-token', amount: 3000 }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.order.orderId).toBe('order_123')
    expect(body.order.amount).toBe(3000)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. POST /api/payments/public-verify
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/payments/public-verify', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when required fields missing', async () => {
    const res = await publicVerifyPOST(makeReq('/api/payments/public-verify', 'POST', { token: 'abc' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when payment link not found', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue(null)

    const res = await publicVerifyPOST(makeReq('/api/payments/public-verify', 'POST', {
      token: 'bad', orderId: 'o1', paymentId: 'p1',
    }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when gateway not configured', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue({
      id: 'pl1', hospitalId: 'h1',
      invoice: { id: 'inv1', paidAmount: 0, totalAmount: 5000 },
    } as any)
    mockGetGateway.mockResolvedValue(null)

    const res = await publicVerifyPOST(makeReq('/api/payments/public-verify', 'POST', {
      token: 'valid', orderId: 'o1', paymentId: 'p1',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when verification fails', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue({
      id: 'pl1', hospitalId: 'h1', amount: 5000,
      invoice: { id: 'inv1', paidAmount: 0, totalAmount: 5000 },
    } as any)
    mockGetGateway.mockResolvedValue({
      gateway: { verifyPayment: vi.fn().mockResolvedValue({ verified: false }) },
      credentials: { provider: 'RAZORPAY' },
    })

    const res = await publicVerifyPOST(makeReq('/api/payments/public-verify', 'POST', {
      token: 'valid', orderId: 'o1', paymentId: 'p1', signature: 'bad',
    }))
    expect(res.status).toBe(400)
  })

  it('verifies payment and creates record with $transaction', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue({
      id: 'pl1', hospitalId: 'h1', amount: 5000,
      invoice: { id: 'inv1', paidAmount: 0, totalAmount: 5000 },
    } as any)
    mockGetGateway.mockResolvedValue({
      gateway: {
        verifyPayment: vi.fn().mockResolvedValue({
          verified: true, transactionId: 'txn_123', amount: 5000, status: 'CAPTURED',
        }),
      },
      credentials: { provider: 'RAZORPAY' },
    })
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({ paymentNo: 'PAY00050' } as any)
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}, {}])

    const res = await publicVerifyPOST(makeReq('/api/payments/public-verify', 'POST', {
      token: 'valid', orderId: 'o1', paymentId: 'p1', signature: 'good',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.payment.paymentNo).toBe('PAY00051')
    expect(body.payment.amount).toBe(5000)
    expect(body.payment.transactionId).toBe('txn_123')
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('handles partial payment correctly', async () => {
    vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue({
      id: 'pl1', hospitalId: 'h1', amount: 3000,
      invoice: { id: 'inv1', paidAmount: 2000, totalAmount: 5000 },
    } as any)
    mockGetGateway.mockResolvedValue({
      gateway: {
        verifyPayment: vi.fn().mockResolvedValue({
          verified: true, transactionId: 'txn_456', amount: 3000, status: 'CAPTURED',
        }),
      },
      credentials: { provider: 'RAZORPAY' },
    })
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null) // no previous payments
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}, {}])

    const res = await publicVerifyPOST(makeReq('/api/payments/public-verify', 'POST', {
      token: 'valid', orderId: 'o1', paymentId: 'p1',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.payment.paymentNo).toBe('PAY00001') // first payment since findFirst returned null
  })
})
