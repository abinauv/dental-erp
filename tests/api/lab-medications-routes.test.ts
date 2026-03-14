// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
  GET as labOrdersGET,
  POST as labOrdersPOST,
} from '@/app/api/lab-orders/route'
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
// 1. GET /api/lab-orders
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/lab-orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await labOrdersGET(makeReq('/api/lab-orders'))
    expect(res.status).toBe(401)
  })

  it('returns lab orders with pagination', async () => {
    mockAuth()
    const mockOrders = [
      {
        id: 'lo1',
        orderNumber: 'LAB20260001',
        workType: 'CROWN',
        labVendor: { id: 'v1', name: 'Lab A', phone: '9876543210', avgTurnaround: 5 },
        patient: { id: 'p1', patientId: 'PT001', firstName: 'John', lastName: 'Doe', phone: '9876543211' },
      },
    ]
    vi.mocked(prisma.labOrder.count).mockResolvedValue(1)
    vi.mocked(prisma.labOrder.findMany).mockResolvedValue(mockOrders as any)

    const res = await labOrdersGET(makeReq('/api/lab-orders'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].vendorName).toBe('Lab A')
    expect(body.data[0].patientName).toBe('John Doe')
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      pages: 1,
    })
  })

  it('applies search filter', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.count).mockResolvedValue(0)
    vi.mocked(prisma.labOrder.findMany).mockResolvedValue([])

    await labOrdersGET(makeReq('/api/lab-orders?search=crown'))

    expect(prisma.labOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hospitalId: 'h1',
          OR: expect.any(Array),
        }),
      })
    )
  })

  it('applies status and vendor filters', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.count).mockResolvedValue(0)
    vi.mocked(prisma.labOrder.findMany).mockResolvedValue([])

    await labOrdersGET(makeReq('/api/lab-orders?status=CREATED&vendor_id=v1'))

    expect(prisma.labOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CREATED',
          labVendorId: 'v1',
        }),
      })
    )
  })

  it('applies date range filters', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.count).mockResolvedValue(0)
    vi.mocked(prisma.labOrder.findMany).mockResolvedValue([])

    await labOrdersGET(makeReq('/api/lab-orders?date_from=2026-01-01&date_to=2026-01-31'))

    expect(prisma.labOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orderDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      })
    )
  })

  it('applies pagination correctly', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.count).mockResolvedValue(50)
    vi.mocked(prisma.labOrder.findMany).mockResolvedValue([])

    await labOrdersGET(makeReq('/api/lab-orders?page=3&limit=10'))

    expect(prisma.labOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/lab-orders
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/lab-orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await labOrdersPOST(makeReq('/api/lab-orders', 'POST', {}))
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    mockAuth()
    const res = await labOrdersPOST(makeReq('/api/lab-orders', 'POST', {
      patientId: 'p1',
      // missing labVendorId, workType, orderDate, estimatedCost
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Missing required fields')
  })

  it('returns 404 when patient not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)

    const res = await labOrdersPOST(makeReq('/api/lab-orders', 'POST', {
      patientId: 'p1',
      labVendorId: 'v1',
      workType: 'CROWN',
      orderDate: '2026-01-15',
      estimatedCost: 5000,
    }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Patient not found')
  })

  it('returns 404 when lab vendor not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.labVendor.findFirst).mockResolvedValue(null)

    const res = await labOrdersPOST(makeReq('/api/lab-orders', 'POST', {
      patientId: 'p1',
      labVendorId: 'v1',
      workType: 'CROWN',
      orderDate: '2026-01-15',
      estimatedCost: 5000,
    }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Lab vendor not found')
  })

  it('creates lab order with generated order number', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.labVendor.findFirst).mockResolvedValue({ id: 'v1' } as any)
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue(null) // no previous orders

    const mockCreated = {
      id: 'lo1',
      orderNumber: 'LAB20260001',
      status: 'CREATED',
      patient: { patientId: 'PT001', firstName: 'John', lastName: 'Doe' },
      labVendor: { name: 'Lab A' },
    }
    vi.mocked(prisma.labOrder.create).mockResolvedValue(mockCreated as any)

    const res = await labOrdersPOST(makeReq('/api/lab-orders', 'POST', {
      patientId: 'p1',
      labVendorId: 'v1',
      workType: 'CROWN',
      orderDate: '2026-01-15',
      estimatedCost: 5000,
      description: 'Ceramic crown for tooth 14',
      toothNumbers: '14',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.orderNumber).toBe('LAB20260001')
    expect(prisma.labOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'h1',
          status: 'CREATED',
          workType: 'CROWN',
        }),
      })
    )
  })

  it('increments order number from last existing order', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.labVendor.findFirst).mockResolvedValue({ id: 'v1' } as any)
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue({
      orderNumber: 'LAB20260042',
    } as any)
    vi.mocked(prisma.labOrder.create).mockResolvedValue({ id: 'lo2' } as any)

    await labOrdersPOST(makeReq('/api/lab-orders', 'POST', {
      patientId: 'p1',
      labVendorId: 'v1',
      workType: 'BRIDGE',
      orderDate: '2026-02-01',
      estimatedCost: 8000,
    }))

    expect(prisma.labOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderNumber: `LAB${new Date().getFullYear()}0043`,
        }),
      })
    )
  })
})
