// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// Mock mysql2 pool for suppliers/transactions/alerts routes
const { mockExecute, mockConnection } = vi.hoisted(() => {
  const mockConnection = {
    execute: vi.fn(),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  }
  return { mockExecute: vi.fn(), mockConnection }
})

vi.mock('@/lib/db', () => ({
  default: {
    execute: mockExecute,
    getConnection: vi.fn(() => mockConnection),
  },
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as categoriesGET } from '@/app/api/inventory/categories/route'
import { GET as suppliersGET, POST as suppliersPOST } from '@/app/api/inventory/suppliers/route'
import { GET as transactionsGET, POST as transactionsPOST } from '@/app/api/inventory/transactions/route'
import { GET as alertsGET, POST as alertsPOST } from '@/app/api/inventory/alerts/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Auth helpers ─────────────────────────────────────────────────────────────

function mockAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
    session: { user: { id: 'u1', name: 'Admin', role: 'ADMIN' } },
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
// 1. GET /api/inventory/categories
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/inventory/categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await categoriesGET(makeReq('/api/inventory/categories'))
    expect(res.status).toBe(401)
  })

  it('returns categories with item counts', async () => {
    mockAuth()
    vi.mocked(prisma.inventoryCategory.findMany).mockResolvedValue([
      { id: 'c1', name: 'Dental Materials', _count: { items: 15 } },
      { id: 'c2', name: 'Equipment', _count: { items: 8 } },
    ] as any)

    const res = await categoriesGET(makeReq('/api/inventory/categories'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].item_count).toBe(15)
    expect(body.data[1].item_count).toBe(8)
  })

  it('returns empty array when no categories', async () => {
    mockAuth()
    vi.mocked(prisma.inventoryCategory.findMany).mockResolvedValue([])

    const res = await categoriesGET(makeReq('/api/inventory/categories'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET/POST /api/inventory/suppliers
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/inventory/suppliers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await suppliersGET(makeReq('/api/inventory/suppliers'))
    expect(res.status).toBe(401)
  })

  it('returns suppliers with pagination', async () => {
    mockAuth()
    // count query
    mockExecute.mockResolvedValueOnce([[{ total: 2 }]])
    // data query
    mockExecute.mockResolvedValueOnce([[
      { id: 1, name: 'DentSupply', supplier_code: 'DS001' },
      { id: 2, name: 'MediParts', supplier_code: 'MP001' },
    ]])

    const res = await suppliersGET(makeReq('/api/inventory/suppliers'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
  })

  it('applies search filter to SQL query', async () => {
    mockAuth()
    mockExecute.mockResolvedValueOnce([[{ total: 0 }]])
    mockExecute.mockResolvedValueOnce([[]])

    await suppliersGET(makeReq('/api/inventory/suppliers?search=dent'))

    // Both count and data queries should include search params
    const countCall = mockExecute.mock.calls[0]
    expect(countCall[1]).toContain('%dent%')
  })
})

describe('POST /api/inventory/suppliers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await suppliersPOST(makeReq('/api/inventory/suppliers', 'POST', { name: 'Test' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await suppliersPOST(makeReq('/api/inventory/suppliers', 'POST', { name: 'Test' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('supplier_code')
  })

  it('returns 409 for duplicate supplier_code', async () => {
    mockAuth()
    // Check for existing returns a match
    mockExecute.mockResolvedValueOnce([[{ id: 1 }]])

    const res = await suppliersPOST(makeReq('/api/inventory/suppliers', 'POST', {
      supplier_code: 'DS001',
      name: 'DentSupply',
      phone: '9876543210',
    }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('already exists')
  })

  it('creates supplier successfully', async () => {
    mockAuth()
    // No existing supplier
    mockExecute.mockResolvedValueOnce([[]])
    // Insert result
    mockExecute.mockResolvedValueOnce([{ insertId: 42 }])

    const res = await suppliersPOST(makeReq('/api/inventory/suppliers', 'POST', {
      supplier_code: 'DS002',
      name: 'New Dental Supply',
      phone: '9876543210',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(42)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET/POST /api/inventory/transactions
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/inventory/transactions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await transactionsGET(makeReq('/api/inventory/transactions'))
    expect(res.status).toBe(401)
  })

  it('returns transactions with pagination', async () => {
    mockAuth()
    // count query
    mockExecute.mockResolvedValueOnce([[{ total: 5 }]])
    // data query
    mockExecute.mockResolvedValueOnce([[
      { id: 1, transaction_type: 'purchase', item_name: 'Gloves', quantity: 100 },
    ]])

    const res = await transactionsGET(makeReq('/api/inventory/transactions'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.pagination.total).toBe(5)
  })

  it('filters by item and type', async () => {
    mockAuth()
    mockExecute.mockResolvedValueOnce([[{ total: 0 }]])
    mockExecute.mockResolvedValueOnce([[]])

    await transactionsGET(makeReq('/api/inventory/transactions?itemId=item1&type=purchase'))

    const dataCall = mockExecute.mock.calls[1]
    expect(dataCall[1]).toContain('item1')
    expect(dataCall[1]).toContain('purchase')
  })
})

describe('POST /api/inventory/transactions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await transactionsPOST(makeReq('/api/inventory/transactions', 'POST', {
      transaction_type: 'purchase',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('item_id')
  })

  it('returns 404 when item not found', async () => {
    mockAuth()
    // Item lookup returns empty
    mockConnection.execute.mockResolvedValueOnce([[]])

    const res = await transactionsPOST(makeReq('/api/inventory/transactions', 'POST', {
      transaction_type: 'purchase',
      item_id: 'nonexistent',
      quantity: 10,
      transaction_date: '2026-02-01',
    }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toContain('Inventory item not found')
  })

  it('returns 400 for insufficient stock on sale', async () => {
    mockAuth()
    // Item with low stock
    mockConnection.execute.mockResolvedValueOnce([[{ id: 'item1', current_stock: 5, minimum_stock: 2, unit_price: 100 }]])

    const res = await transactionsPOST(makeReq('/api/inventory/transactions', 'POST', {
      transaction_type: 'sale',
      item_id: 'item1',
      quantity: 10,
      transaction_date: '2026-02-01',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Insufficient stock')
  })

  it('creates purchase transaction and updates stock', async () => {
    mockAuth()
    // Item lookup
    mockConnection.execute.mockResolvedValueOnce([[{ id: 'item1', current_stock: 50, minimum_stock: 10, unit_price: 100 }]])
    // Insert transaction
    mockConnection.execute.mockResolvedValueOnce([{ insertId: 99 }])
    // Update stock
    mockConnection.execute.mockResolvedValueOnce([{}])
    // Delete alerts (stock above minimum)
    mockConnection.execute.mockResolvedValueOnce([{}])

    const res = await transactionsPOST(makeReq('/api/inventory/transactions', 'POST', {
      transaction_type: 'purchase',
      item_id: 'item1',
      quantity: 20,
      transaction_date: '2026-02-01',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.new_stock).toBe(70)
    expect(mockConnection.commit).toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. GET/POST /api/inventory/alerts
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/inventory/alerts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await alertsGET(makeReq('/api/inventory/alerts'))
    expect(res.status).toBe(401)
  })

  it('returns alerts with summary', async () => {
    mockAuth()
    // alerts query
    mockExecute.mockResolvedValueOnce([[
      { id: 1, alert_type: 'low_stock', item_name: 'Gloves', current_stock: 3 },
    ]])
    // summary query
    mockExecute.mockResolvedValueOnce([[{
      total_alerts: 5,
      out_of_stock: 1,
      low_stock: 3,
      expiring_soon: 1,
      expired: 0,
    }]])

    const res = await alertsGET(makeReq('/api/inventory/alerts'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.summary.total_alerts).toBe(5)
    expect(body.summary.low_stock).toBe(3)
  })
})

describe('POST /api/inventory/alerts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when alert_id missing', async () => {
    mockAuth()
    const res = await alertsPOST(makeReq('/api/inventory/alerts', 'POST', {}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Alert ID')
  })

  it('returns 404 when alert not found', async () => {
    mockAuth()
    mockExecute.mockResolvedValueOnce([[]])

    const res = await alertsPOST(makeReq('/api/inventory/alerts', 'POST', { alert_id: 999 }))
    const body = await res.json()

    expect(res.status).toBe(404)
  })

  it('acknowledges alert successfully', async () => {
    mockAuth()
    // Alert check
    mockExecute.mockResolvedValueOnce([[{ id: 1 }]])
    // Update
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await alertsPOST(makeReq('/api/inventory/alerts', 'POST', {
      alert_id: 1,
      notes: 'Ordered more stock',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
