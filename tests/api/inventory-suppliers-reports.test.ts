// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  default: { execute: mockExecute },
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  GET as supplierDetailGET,
  PUT as supplierDetailPUT,
  DELETE as supplierDetailDELETE,
} from '@/app/api/inventory/suppliers/[id]/route'
import { GET as reportsGET } from '@/app/api/inventory/reports/route'
import { requireAuthAndRole } from '@/lib/api-helpers'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/inventory/suppliers/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/inventory/suppliers/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await supplierDetailGET(makeReq('/api/inventory/suppliers/s1'), makeParams('s1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when supplier not found', async () => {
    mockAuth()
    mockExecute.mockResolvedValueOnce([[]]) // main query: empty
    const res = await supplierDetailGET(makeReq('/api/inventory/suppliers/s1'), makeParams('s1') as any)
    expect(res.status).toBe(404)
  })

  it('returns supplier detail with items and purchase orders', async () => {
    mockAuth()
    // Main supplier query
    mockExecute.mockResolvedValueOnce([[{
      id: 's1', name: 'MedSupply Corp', items_supplied: 5,
      total_orders: 3, completed_business: 50000, pending_business: 10000,
    }]])
    // Items query
    mockExecute.mockResolvedValueOnce([[
      { id: 'i1', item_code: 'IC001', name: 'Gloves', current_stock: 100, unit_price: 5 },
    ]])
    // Purchase orders query
    mockExecute.mockResolvedValueOnce([[
      { id: 'po1', po_number: 'PO001', total_amount: 5000, status: 'received' },
    ]])

    const res = await supplierDetailGET(makeReq('/api/inventory/suppliers/s1'), makeParams('s1') as any)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.name).toBe('MedSupply Corp')
    expect(body.data.items_supplied_list).toHaveLength(1)
    expect(body.data.recent_purchase_orders).toHaveLength(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. PUT /api/inventory/suppliers/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/inventory/suppliers/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await supplierDetailPUT(
      makeReq('/api/inventory/suppliers/s1', 'PUT', { name: 'X' }),
      makeParams('s1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 when supplier not found', async () => {
    mockAuth()
    mockExecute.mockResolvedValueOnce([[]])
    const res = await supplierDetailPUT(
      makeReq('/api/inventory/suppliers/s1', 'PUT', { name: 'X' }),
      makeParams('s1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when supplier_code conflicts', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ id: 's1', supplier_code: 'SC001' }]]) // existing
      .mockResolvedValueOnce([[{ id: 's2' }]]) // duplicate check
    const res = await supplierDetailPUT(
      makeReq('/api/inventory/suppliers/s1', 'PUT', { supplier_code: 'SC002' }),
      makeParams('s1') as any,
    )
    expect(res.status).toBe(409)
  })

  it('updates supplier successfully', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ id: 's1', supplier_code: 'SC001' }]]) // existing
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update
    const res = await supplierDetailPUT(
      makeReq('/api/inventory/suppliers/s1', 'PUT', { name: 'Updated Corp' }),
      makeParams('s1') as any,
    )
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. DELETE /api/inventory/suppliers/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/inventory/suppliers/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await supplierDetailDELETE(
      makeReq('/api/inventory/suppliers/s1', 'DELETE'),
      makeParams('s1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 when supplier not found', async () => {
    mockAuth()
    mockExecute.mockResolvedValueOnce([[]])
    const res = await supplierDetailDELETE(
      makeReq('/api/inventory/suppliers/s1', 'DELETE'),
      makeParams('s1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('soft deletes supplier with relationships (POs or items)', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ id: 's1' }]]) // existing
      .mockResolvedValueOnce([[{ count: 2 }]]) // has purchase orders
      .mockResolvedValueOnce([[{ count: 0 }]]) // no items
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // soft delete
    const res = await supplierDetailDELETE(
      makeReq('/api/inventory/suppliers/s1', 'DELETE'),
      makeParams('s1') as any,
    )
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('hard deletes supplier with no relationships', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ id: 's1' }]]) // existing
      .mockResolvedValueOnce([[{ count: 0 }]]) // no POs
      .mockResolvedValueOnce([[{ count: 0 }]]) // no items
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // hard delete
    const res = await supplierDetailDELETE(
      makeReq('/api/inventory/suppliers/s1', 'DELETE'),
      makeParams('s1') as any,
    )
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. GET /api/inventory/reports
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/inventory/reports', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await reportsGET(makeReq('/api/inventory/reports'))
    expect(res.status).toBe(401)
  })

  it('returns summary report by default', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{
        total_items: 50, active_items: 45, out_of_stock_items: 2,
        low_stock_items: 5, total_inventory_value: 100000,
        active_suppliers: 10, pending_alerts: 3,
      }]])
      .mockResolvedValueOnce([[{ category: 'Instruments', item_count: 20, category_value: 50000 }]])
      .mockResolvedValueOnce([[{ item_type: 'CONSUMABLE', item_count: 30, type_value: 40000 }]])

    const res = await reportsGET(makeReq('/api/inventory/reports'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.summary.total_items).toBe(50)
    expect(body.data.category_breakdown).toHaveLength(1)
    expect(body.data.type_breakdown).toHaveLength(1)
  })

  it('returns low stock report', async () => {
    mockAuth()
    mockExecute.mockResolvedValueOnce([[
      { id: 'i1', name: 'Gloves', current_stock: 5, minimum_stock: 10, urgency: 'critical' },
    ]])

    const res = await reportsGET(makeReq('/api/inventory/reports?type=low_stock'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].urgency).toBe('critical')
  })

  it('returns expiring items report', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ id: 'i1', name: 'Lidocaine', days_to_expiry: 10, urgency: 'warning' }]])
      .mockResolvedValueOnce([[{ expired_batches: 1, expired_value: 500, expiring_soon_batches: 3 }]])

    const res = await reportsGET(makeReq('/api/inventory/reports?type=expiring&days=30'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.summary.expired_batches).toBe(1)
  })

  it('returns stock valuation report', async () => {
    mockAuth()
    mockExecute
      .mockResolvedValueOnce([[{ id: 'i1', name: 'Composite', stock_value: 25000 }]])
      .mockResolvedValueOnce([[{ total_value: 100000, items_in_stock: 50 }]])

    const res = await reportsGET(makeReq('/api/inventory/reports?type=stock_valuation'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.totals.total_value).toBe(100000)
    expect(body.data.items).toHaveLength(1)
  })

  it('returns dead stock report', async () => {
    mockAuth()
    mockExecute.mockResolvedValueOnce([[
      { id: 'i1', name: 'Old Material', days_since_last_movement: 120, locked_value: 5000 },
    ]])

    const res = await reportsGET(makeReq('/api/inventory/reports?type=dead_stock&days=90'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
  })

  it('returns stock movement report', async () => {
    mockAuth()
    mockExecute.mockResolvedValueOnce([[
      { id: 'i1', name: 'Gloves', total_in: 100, total_out: 40, transaction_count: 5 },
    ]])

    const res = await reportsGET(makeReq('/api/inventory/reports?type=movement&startDate=2026-01-01&endDate=2026-02-01'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
  })

  it('returns 400 for movement report without dates', async () => {
    mockAuth()
    const res = await reportsGET(makeReq('/api/inventory/reports?type=movement'))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('date')
  })

  it('returns 400 for invalid report type', async () => {
    mockAuth()
    const res = await reportsGET(makeReq('/api/inventory/reports?type=invalid'))
    expect(res.status).toBe(400)
  })
})
