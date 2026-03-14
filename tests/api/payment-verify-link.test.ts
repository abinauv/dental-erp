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

import { POST as verifyPOST } from '@/app/api/payments/verify/route'
import { POST as linkPOST } from '@/app/api/payments/link/route'
import { GET as auditLogsGET } from '@/app/api/settings/audit-logs/route'
import { getAuthenticatedHospital, requireAuthAndRole } from '@/lib/api-helpers'
import { getGateway } from '@/lib/payment-gateways'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockHospitalAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
    hospitalId: 'h1',
  }
  vi.mocked(getAuthenticatedHospital).mockResolvedValue({ ...defaults, ...overrides } as any)
}

function mockHospitalAuthError() {
  vi.mocked(getAuthenticatedHospital).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  } as any)
}

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

function makeReq(path: string, method = 'POST', body?: any): NextRequest {
  const url = `http://localhost${path}`
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init)
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. POST /api/payments/verify
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/payments/verify', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockHospitalAuthError()
    const res = await verifyPOST(makeReq('/api/payments/verify', 'POST', {}))
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields missing', async () => {
    mockHospitalAuth()
    const res = await verifyPOST(makeReq('/api/payments/verify', 'POST', { invoiceId: 'inv1' }))
    const body = await res.json()
    expect(res.status).toBe(400)
  })

  it('returns 404 when invoice not found', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null)

    const res = await verifyPOST(makeReq('/api/payments/verify', 'POST', {
      invoiceId: 'inv-none', orderId: 'order1', paymentId: 'pay1',
    }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when gateway not configured', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1', balanceAmount: 5000, paidAmount: 0, totalAmount: 5000,
    } as any)
    vi.mocked(getGateway).mockResolvedValue(null)

    const res = await verifyPOST(makeReq('/api/payments/verify', 'POST', {
      invoiceId: 'inv1', orderId: 'order1', paymentId: 'pay1',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when verification fails', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1', balanceAmount: 5000, paidAmount: 0, totalAmount: 5000,
    } as any)
    vi.mocked(getGateway).mockResolvedValue({
      gateway: { verifyPayment: vi.fn().mockResolvedValue({ verified: false, status: 'FAILED' }) },
      credentials: { provider: 'RAZORPAY' },
    } as any)

    const res = await verifyPOST(makeReq('/api/payments/verify', 'POST', {
      invoiceId: 'inv1', orderId: 'order1', paymentId: 'pay1', signature: 'sig',
    }))
    expect(res.status).toBe(400)
  })

  it('verifies payment and creates record', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1', balanceAmount: 5000, paidAmount: 0, totalAmount: 5000,
    } as any)
    vi.mocked(getGateway).mockResolvedValue({
      gateway: {
        verifyPayment: vi.fn().mockResolvedValue({
          verified: true, status: 'CAPTURED', transactionId: 'txn123', amount: 5000,
        }),
      },
      credentials: { provider: 'RAZORPAY' },
    } as any)
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({ paymentNo: 'PAY00010' } as any)
    vi.mocked(prisma.$transaction).mockResolvedValue([{
      id: 'pay1', paymentNo: 'PAY00011', amount: 5000,
    }] as any)

    const res = await verifyPOST(makeReq('/api/payments/verify', 'POST', {
      invoiceId: 'inv1', orderId: 'order1', paymentId: 'pay1', signature: 'sig',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.payment.status).toBe('COMPLETED')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/payments/link
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/payments/link', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockHospitalAuthError()
    const res = await linkPOST(makeReq('/api/payments/link', 'POST', {}))
    expect(res.status).toBe(401)
  })

  it('returns 400 when invoiceId missing', async () => {
    mockHospitalAuth()
    const res = await linkPOST(makeReq('/api/payments/link', 'POST', {}))
    const body = await res.json()
    expect(res.status).toBe(400)
  })

  it('returns 404 when invoice not found', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null)

    const res = await linkPOST(makeReq('/api/payments/link', 'POST', { invoiceId: 'inv-none' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when invoice fully paid', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1', invoiceNo: 'INV001', balanceAmount: 0, status: 'PAID',
    } as any)

    const res = await linkPOST(makeReq('/api/payments/link', 'POST', { invoiceId: 'inv1' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('fully paid')
  })

  it('returns 400 when gateway not enabled', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1', invoiceNo: 'INV001', balanceAmount: 5000, status: 'PENDING',
    } as any)
    vi.mocked(prisma.paymentGatewayConfig.findUnique).mockResolvedValue(null)

    const res = await linkPOST(makeReq('/api/payments/link', 'POST', { invoiceId: 'inv1' }))
    expect(res.status).toBe(400)
  })

  it('creates payment link successfully', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv1', invoiceNo: 'INV001', balanceAmount: 3000, status: 'PARTIALLY_PAID',
    } as any)
    vi.mocked(prisma.paymentGatewayConfig.findUnique).mockResolvedValue({
      isEnabled: true,
    } as any)
    vi.mocked(prisma.paymentLink.create).mockResolvedValue({
      id: 'pl1', token: 'abc123', amount: 3000,
    } as any)

    const res = await linkPOST(makeReq('/api/payments/link', 'POST', { invoiceId: 'inv1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.link.amount).toBe(3000)
    expect(body.link.invoiceNo).toBe('INV001')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/settings/audit-logs
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/settings/audit-logs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await auditLogsGET(makeReq('/api/settings/audit-logs', 'GET'))
    expect(res.status).toBe(401)
  })

  it('returns audit logs with pagination', async () => {
    mockAuth()
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      { id: 'al1', action: 'CREATE', entityType: 'Patient', user: { name: 'Admin', email: 'a@b.com', role: 'ADMIN' } },
    ] as any)
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1)

    const res = await auditLogsGET(makeReq('/api/settings/audit-logs', 'GET'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('filters by userId, entityType, action, and date range', async () => {
    mockAuth()
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0)

    await auditLogsGET(makeReq('/api/settings/audit-logs?userId=u1&entityType=Patient&action=CREATE&from=2026-01-01&to=2026-02-28', 'GET'))

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'u1',
          entityType: 'Patient',
          action: 'CREATE',
          createdAt: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-02-28'),
          },
        }),
      })
    )
  })
})
