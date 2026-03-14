// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// Mock the raw SQL pool for [id] routes
const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  default: { execute: mockExecute },
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  GET as vendorsGET,
  POST as vendorsPOST,
} from '@/app/api/lab-vendors/route'
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
    const res = await vendorsPOST(makeReq('/api/lab-vendors', 'POST', { name: 'Lab A', phone: '123' }))
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
      id: 'v1', name: 'Lab A', phone: '9876543210', hospitalId: 'h1', isActive: true,
    } as any)

    const res = await vendorsPOST(makeReq('/api/lab-vendors', 'POST', {
      name: 'Lab A',
      phone: '9876543210',
      contactPerson: 'Dr. Smith',
      email: 'lab@example.com',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Lab A')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/lab-vendors/[id] (Raw SQL)
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/lab-vendors/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await vendorDetailGET(makeReq('/api/lab-vendors/v1'), makeParams('v1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when vendor not found', async () => {
    mockAuth()
    mockExecute.mockResolvedValue([[]])
    const res = await vendorDetailGET(makeReq('/api/lab-vendors/v1'), makeParams('v1') as any)
    expect(res.status).toBe(404)
  })

  it('returns vendor detail', async () => {
    mockAuth()
    mockExecute.mockResolvedValue([[{ id: 'v1', name: 'Lab A', phone: '9876543210' }]])

    const res = await vendorDetailGET(makeReq('/api/lab-vendors/v1'), makeParams('v1') as any)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Lab A')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. PUT /api/lab-vendors/[id] (Raw SQL)
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/lab-vendors/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when vendor not found', async () => {
    mockAuth()
    mockExecute.mockResolvedValue([[]])
    const res = await vendorDetailPUT(
      makeReq('/api/lab-vendors/v1', 'PUT', {
        vendor_code: 'V001', name: 'Lab A', phone: '123',
      }),
      makeParams('v1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    mockExecute.mockResolvedValue([[{ id: 'v1' }]])
    const res = await vendorDetailPUT(
      makeReq('/api/lab-vendors/v1', 'PUT', { email: 'test@lab.com' }),
      makeParams('v1') as any,
    )
    expect(res.status).toBe(400)
  })

  it('returns 409 when vendor_code is duplicate', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ id: 'v1' }]])  // existing check
      .mockResolvedValueOnce([[{ id: 'v2' }]])   // duplicate check
    const res = await vendorDetailPUT(
      makeReq('/api/lab-vendors/v1', 'PUT', {
        vendor_code: 'V001', name: 'Lab A', phone: '123',
      }),
      makeParams('v1') as any,
    )
    expect(res.status).toBe(409)
  })

  it('updates vendor successfully', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ id: 'v1' }]])  // existing check
      .mockResolvedValueOnce([[]])                // no duplicate
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update
    const res = await vendorDetailPUT(
      makeReq('/api/lab-vendors/v1', 'PUT', {
        vendor_code: 'V001', name: 'Lab A Updated', phone: '9876543210',
      }),
      makeParams('v1') as any,
    )
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. DELETE /api/lab-vendors/[id] (Raw SQL)
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/lab-vendors/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when vendor not found', async () => {
    mockAuth()
    mockExecute.mockResolvedValue([[]])
    const res = await vendorDetailDELETE(makeReq('/api/lab-vendors/v1', 'DELETE'), makeParams('v1') as any)
    expect(res.status).toBe(404)
  })

  it('returns 400 when vendor has lab orders', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ id: 'v1' }]])    // existing check
      .mockResolvedValueOnce([[{ id: 'lo1' }]])    // has orders
    const res = await vendorDetailDELETE(makeReq('/api/lab-vendors/v1', 'DELETE'), makeParams('v1') as any)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('existing lab orders')
  })

  it('soft deletes vendor', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ id: 'v1' }]])  // existing check
      .mockResolvedValueOnce([[]])                // no orders
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // delete
    const res = await vendorDetailDELETE(makeReq('/api/lab-vendors/v1', 'DELETE'), makeParams('v1') as any)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. GET /api/lab-orders/[id] (Raw SQL)
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/lab-orders/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await labOrderDetailGET(makeReq('/api/lab-orders/lo1'), makeParams('lo1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when order not found', async () => {
    mockAuth()
    mockExecute.mockResolvedValue([[]])
    const res = await labOrderDetailGET(makeReq('/api/lab-orders/lo1'), makeParams('lo1') as any)
    expect(res.status).toBe(404)
  })

  it('returns order with history and documents', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{
        id: 'lo1', work_type: 'CROWN', status: 'in_progress',
        vendor_name: 'Lab A', patient_name: 'John Doe',
      }]])
      .mockResolvedValueOnce([[{ id: 'hist1', status_from: 'created', status_to: 'in_progress' }]])
      .mockResolvedValueOnce([[{ id: 'doc1', file_name: 'scan.jpg' }]])

    const res = await labOrderDetailGET(makeReq('/api/lab-orders/lo1'), makeParams('lo1') as any)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.work_type).toBe('CROWN')
    expect(body.data.history).toHaveLength(1)
    expect(body.data.documents).toHaveLength(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. PUT /api/lab-orders/[id] (Raw SQL)
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/lab-orders/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when order not found', async () => {
    mockAuth()
    mockExecute.mockResolvedValue([[]])
    const res = await labOrderDetailPUT(
      makeReq('/api/lab-orders/lo1', 'PUT', {
        patient_id: 'p1', lab_vendor_id: 'v1', work_type: 'CROWN',
        order_date: '2026-01-01', estimated_cost: 5000,
      }),
      makeParams('lo1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    mockExecute.mockResolvedValue([[{ status: 'created' }]])
    const res = await labOrderDetailPUT(
      makeReq('/api/lab-orders/lo1', 'PUT', { notes: 'test' }),
      makeParams('lo1') as any,
    )
    expect(res.status).toBe(400)
  })

  it('updates lab order and logs status change', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ status: 'created' }]])        // existing check
      .mockResolvedValueOnce([{ affectedRows: 1 }])            // update
      .mockResolvedValueOnce([{ affectedRows: 1 }])            // history insert

    const res = await labOrderDetailPUT(
      makeReq('/api/lab-orders/lo1', 'PUT', {
        patient_id: 'p1', lab_vendor_id: 'v1', work_type: 'CROWN',
        order_date: '2026-01-01', estimated_cost: 5000, status: 'sent',
      }),
      makeParams('lo1') as any,
    )
    const body = await res.json()

    expect(body.success).toBe(true)
    // 3 calls: existing check + update + history insert
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })

  it('skips history insert when status unchanged', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ status: 'created' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    await labOrderDetailPUT(
      makeReq('/api/lab-orders/lo1', 'PUT', {
        patient_id: 'p1', lab_vendor_id: 'v1', work_type: 'CROWN',
        order_date: '2026-01-01', estimated_cost: 5000, status: 'created',
      }),
      makeParams('lo1') as any,
    )

    // Only 2 calls: existing check + update (no history)
    expect(mockExecute).toHaveBeenCalledTimes(2)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8. DELETE /api/lab-orders/[id] (Raw SQL)
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/lab-orders/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when order not found', async () => {
    mockAuth()
    mockExecute.mockResolvedValue([[]])
    const res = await labOrderDetailDELETE(makeReq('/api/lab-orders/lo1', 'DELETE'), makeParams('lo1') as any)
    expect(res.status).toBe(404)
  })

  it('returns 400 when order is in progress', async () => {
    mockAuth()
    mockExecute.mockResolvedValue([[{ status: 'in_progress' }]])
    const res = await labOrderDetailDELETE(makeReq('/api/lab-orders/lo1', 'DELETE'), makeParams('lo1') as any)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('in progress')
  })

  it('allows deletion of created status orders', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ status: 'created' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
    const res = await labOrderDetailDELETE(makeReq('/api/lab-orders/lo1', 'DELETE'), makeParams('lo1') as any)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('allows deletion of cancelled status orders', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ status: 'cancelled' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
    const res = await labOrderDetailDELETE(makeReq('/api/lab-orders/lo1', 'DELETE'), makeParams('lo1') as any)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
