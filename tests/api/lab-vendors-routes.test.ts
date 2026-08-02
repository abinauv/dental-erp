// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { LabOrderStatus, LabVendorStatus } from '@prisma/client'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { GET as vendorsGET, POST as vendorsPOST } from '@/app/api/lab-vendors/route'
import {
  GET as vendorDetailGET,
  PUT as vendorDetailPUT,
  DELETE as vendorDetailDELETE,
} from '@/app/api/lab-vendors/[id]/route'
import {
  GET as labOrderDetailGET,
  PUT as labOrderDetailPUT,
  DELETE as labOrderDetailDELETE,
} from '@/app/api/lab-orders/[id]/route'
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
// 1. GET /api/lab-vendors (Prisma)
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/lab-vendors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await vendorsGET(makeReq('/api/lab-vendors'))
    expect(res.status).toBe(401)
  })

  it('returns vendors with pagination', async () => {
    mockAuth()
    const mockVendors = [
      { id: 'v1', name: 'Lab A', phone: '9876543210', isActive: true },
      { id: 'v2', name: 'Lab B', phone: '9876543211', isActive: true },
    ]
    vi.mocked(prisma.labVendor.count).mockResolvedValue(2)
    vi.mocked(prisma.labVendor.findMany).mockResolvedValue(mockVendors as any)

    const res = await vendorsGET(makeReq('/api/lab-vendors'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
  })

  it('filters by search term', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.count).mockResolvedValue(0)
    vi.mocked(prisma.labVendor.findMany).mockResolvedValue([])

    await vendorsGET(makeReq('/api/lab-vendors?search=dental'))

    const whereArg = vi.mocked(prisma.labVendor.findMany).mock.calls[0][0]?.where
    expect(whereArg.OR).toBeDefined()
    expect(whereArg.OR.length).toBe(3)
  })

  it('filters by active status', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.count).mockResolvedValue(0)
    vi.mocked(prisma.labVendor.findMany).mockResolvedValue([])

    await vendorsGET(makeReq('/api/lab-vendors?status=active'))

    const whereArg = vi.mocked(prisma.labVendor.findMany).mock.calls[0][0]?.where
    expect(whereArg.isActive).toBe(true)
  })

  it('filters by inactive status', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.count).mockResolvedValue(0)
    vi.mocked(prisma.labVendor.findMany).mockResolvedValue([])

    await vendorsGET(makeReq('/api/lab-vendors?status=inactive'))

    const whereArg = vi.mocked(prisma.labVendor.findMany).mock.calls[0][0]?.where
    expect(whereArg.isActive).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/lab-vendors (Prisma)
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/lab-vendors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await vendorsPOST(
      makeReq('/api/lab-vendors', 'POST', { name: 'Lab A', phone: '123' })
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await vendorsPOST(makeReq('/api/lab-vendors', 'POST', { email: 'test@lab.com' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('required')
  })

  it('creates a lab vendor', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.create).mockResolvedValue({
      id: 'v1',
      name: 'Lab A',
      phone: '9876543210',
      hospitalId: 'h1',
      isActive: true,
    } as any)

    const res = await vendorsPOST(
      makeReq('/api/lab-vendors', 'POST', {
        name: 'Lab A',
        phone: '9876543210',
        contactPerson: 'Dr. Smith',
        email: 'lab@example.com',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Lab A')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/lab-vendors/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/lab-vendors/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await vendorDetailGET(makeReq('/api/lab-vendors/v1'), makeParams('v1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when vendor not found', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.findFirst).mockResolvedValue(null)

    const res = await vendorDetailGET(makeReq('/api/lab-vendors/v1'), makeParams('v1'))
    expect(res.status).toBe(404)
  })

  it('returns vendor detail', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.findFirst).mockResolvedValue({
      id: 'v1',
      code: 'LV001',
      name: 'Lab A',
      phone: '9876543210',
      status: LabVendorStatus.ACTIVE,
    } as any)

    const res = await vendorDetailGET(makeReq('/api/lab-vendors/v1'), makeParams('v1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('Lab A')
    expect(body.data.code).toBe('LV001')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. PUT /api/lab-vendors/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/lab-vendors/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when vendor not found', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.findFirst).mockResolvedValue(null)

    const res = await vendorDetailPUT(
      makeReq('/api/lab-vendors/v1', 'PUT', { code: 'LV001', name: 'X', phone: '1' }),
      makeParams('v1')
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.findFirst).mockResolvedValue({ id: 'v1' } as any)

    const res = await vendorDetailPUT(
      makeReq('/api/lab-vendors/v1', 'PUT', { name: 'X' }),
      makeParams('v1')
    )
    expect(res.status).toBe(400)
  })

  it('returns 409 when the vendor code is a duplicate', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.findFirst)
      .mockResolvedValueOnce({ id: 'v1' } as any)
      .mockResolvedValueOnce({ id: 'v2' } as any)

    const res = await vendorDetailPUT(
      makeReq('/api/lab-vendors/v1', 'PUT', { code: 'LV002', name: 'X', phone: '1' }),
      makeParams('v1')
    )
    expect(res.status).toBe(409)
  })

  it('updates vendor successfully', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.findFirst)
      .mockResolvedValueOnce({ id: 'v1' } as any)
      .mockResolvedValueOnce(null)
    vi.mocked(prisma.labVendor.update).mockResolvedValue({ id: 'v1' } as any)

    const res = await vendorDetailPUT(
      makeReq('/api/lab-vendors/v1', 'PUT', {
        code: 'LV001',
        name: 'Updated Lab',
        phone: '9876543210',
        status: 'blocked',
        creditLimit: 5000,
      }),
      makeParams('v1')
    )
    expect(res.status).toBe(200)

    const data = vi.mocked(prisma.labVendor.update).mock.calls[0][0].data
    expect(data.name).toBe('Updated Lab')
    expect(data.creditLimit).toBe(5000)
    // Legacy lowercase status is accepted and mapped onto the enum.
    expect(data.status).toBe(LabVendorStatus.BLOCKED)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. DELETE /api/lab-vendors/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/lab-vendors/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when vendor not found', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.findFirst).mockResolvedValue(null)

    const res = await vendorDetailDELETE(makeReq('/api/lab-vendors/v1'), makeParams('v1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when the vendor still has lab orders', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.findFirst).mockResolvedValue({ id: 'v1' } as any)
    vi.mocked(prisma.labOrder.count).mockResolvedValue(3)

    const res = await vendorDetailDELETE(makeReq('/api/lab-vendors/v1'), makeParams('v1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('existing lab orders')
  })

  it('soft deletes the vendor', async () => {
    mockAuth()
    vi.mocked(prisma.labVendor.findFirst).mockResolvedValue({ id: 'v1' } as any)
    vi.mocked(prisma.labOrder.count).mockResolvedValue(0)
    vi.mocked(prisma.labVendor.update).mockResolvedValue({ id: 'v1' } as any)

    const res = await vendorDetailDELETE(makeReq('/api/lab-vendors/v1'), makeParams('v1'))
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.labVendor.update).mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. GET /api/lab-orders/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/lab-orders/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await labOrderDetailGET(makeReq('/api/lab-orders/lo1'), makeParams('lo1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when order not found', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue(null)

    const res = await labOrderDetailGET(makeReq('/api/lab-orders/lo1'), makeParams('lo1'))
    expect(res.status).toBe(404)
  })

  it('returns the order with history and documents', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue({
      id: 'lo1',
      orderNumber: 'LO-001',
      status: LabOrderStatus.IN_PROGRESS,
      createdBy: 'u1',
      labVendor: {
        name: 'Lab A',
        phone: '1',
        email: 'a@lab.com',
        address: 'Street',
        avgTurnaround: 5,
        rating: 4,
      },
      patient: {
        patientId: 'PAT001',
        firstName: 'Rahul',
        lastName: 'Sharma',
        phone: '99',
        email: 'r@x.com',
      },
      history: [
        {
          id: 'h1',
          statusFrom: LabOrderStatus.CREATED,
          statusTo: LabOrderStatus.IN_PROGRESS,
          changedByUser: { name: 'Admin' },
        },
      ],
      documents: [{ id: 'd1', fileName: 'scan.png', uploadedByUser: { name: 'Admin' } }],
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: 'Admin' } as any)

    const res = await labOrderDetailGET(makeReq('/api/lab-orders/lo1'), makeParams('lo1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.vendorName).toBe('Lab A')
    expect(body.data.patientName).toBe('Rahul Sharma')
    expect(body.data.createdByName).toBe('Admin')
    expect(body.data.history[0].changedByName).toBe('Admin')
    expect(body.data.documents[0].uploadedByName).toBe('Admin')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. PUT /api/lab-orders/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/lab-orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockImplementation((arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg)
    )
  })

  const validBody = {
    patientId: 'p1',
    labVendorId: 'v1',
    workType: 'CROWN',
    orderDate: '2026-01-01',
    estimatedCost: 5000,
  }

  it('returns 404 when order not found', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue(null)

    const res = await labOrderDetailPUT(
      makeReq('/api/lab-orders/lo1', 'PUT', validBody),
      makeParams('lo1')
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue({
      id: 'lo1',
      status: LabOrderStatus.CREATED,
    } as any)

    const res = await labOrderDetailPUT(
      makeReq('/api/lab-orders/lo1', 'PUT', { patientId: 'p1' }),
      makeParams('lo1')
    )
    expect(res.status).toBe(400)
  })

  it('updates the lab order and logs the status change', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue({
      id: 'lo1',
      status: LabOrderStatus.CREATED,
    } as any)
    vi.mocked(prisma.labOrder.update).mockResolvedValue({ id: 'lo1' } as any)
    vi.mocked(prisma.labOrderHistory.create).mockResolvedValue({ id: 'h1' } as any)

    const res = await labOrderDetailPUT(
      makeReq('/api/lab-orders/lo1', 'PUT', {
        ...validBody,
        status: LabOrderStatus.IN_PROGRESS,
      }),
      makeParams('lo1')
    )
    expect(res.status).toBe(200)

    expect(prisma.labOrderHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        labOrderId: 'lo1',
        statusFrom: LabOrderStatus.CREATED,
        statusTo: LabOrderStatus.IN_PROGRESS,
        changedBy: 'u1',
      }),
    })
  })

  it('skips the history row when the status is unchanged', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue({
      id: 'lo1',
      status: LabOrderStatus.CREATED,
    } as any)
    vi.mocked(prisma.labOrder.update).mockResolvedValue({ id: 'lo1' } as any)

    const res = await labOrderDetailPUT(
      makeReq('/api/lab-orders/lo1', 'PUT', { ...validBody, status: LabOrderStatus.CREATED }),
      makeParams('lo1')
    )
    expect(res.status).toBe(200)
    expect(prisma.labOrderHistory.create).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8. DELETE /api/lab-orders/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/lab-orders/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when order not found', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue(null)

    const res = await labOrderDetailDELETE(makeReq('/api/lab-orders/lo1'), makeParams('lo1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when the order is already in progress', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue({
      id: 'lo1',
      status: LabOrderStatus.IN_PROGRESS,
    } as any)

    const res = await labOrderDetailDELETE(makeReq('/api/lab-orders/lo1'), makeParams('lo1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('in progress')
  })

  it('allows deletion of created orders', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue({
      id: 'lo1',
      status: LabOrderStatus.CREATED,
    } as any)
    vi.mocked(prisma.labOrder.update).mockResolvedValue({ id: 'lo1' } as any)

    const res = await labOrderDetailDELETE(makeReq('/api/lab-orders/lo1'), makeParams('lo1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(vi.mocked(prisma.labOrder.update).mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
  })

  it('allows deletion of cancelled orders', async () => {
    mockAuth()
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue({
      id: 'lo1',
      status: LabOrderStatus.CANCELLED,
    } as any)
    vi.mocked(prisma.labOrder.update).mockResolvedValue({ id: 'lo1' } as any)

    const res = await labOrderDetailDELETE(makeReq('/api/lab-orders/lo1'), makeParams('lo1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
