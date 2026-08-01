// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { StockAlertType, SupplierStatus } from '@prisma/client'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as categoriesGET } from '@/app/api/inventory/categories/route'
import { GET as suppliersGET, POST as suppliersPOST } from '@/app/api/inventory/suppliers/route'
import {
  GET as transactionsGET,
  POST as transactionsPOST,
} from '@/app/api/inventory/transactions/route'
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

/** Runs interactive $transaction callbacks against the mock client. */
function passthroughTransaction() {
  vi.mocked(prisma.$transaction).mockImplementation((arg: any) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg)
  )
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
// 2. GET /api/inventory/suppliers
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
    vi.mocked(prisma.supplier.count).mockResolvedValue(1)
    vi.mocked(prisma.supplier.findMany).mockResolvedValue([
      {
        id: 's1',
        name: 'Acme Dental',
        code: 'SUP001',
        _count: { preferredForItems: 3, purchaseOrders: 2 },
        purchaseOrders: [{ totalAmount: 1000 }, { totalAmount: 250 }],
      },
    ] as any)

    const res = await suppliersGET(makeReq('/api/inventory/suppliers'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].itemsSupplied).toBe(3)
    expect(body.data[0].totalOrders).toBe(2)
    expect(body.data[0].totalBusiness).toBe(1250)
    expect(body.pagination.total).toBe(1)
  })

  it('applies search filter to the where clause', async () => {
    mockAuth()
    vi.mocked(prisma.supplier.count).mockResolvedValue(0)
    vi.mocked(prisma.supplier.findMany).mockResolvedValue([])

    await suppliersGET(makeReq('/api/inventory/suppliers?search=acme'))

    const where = vi.mocked(prisma.supplier.findMany).mock.calls[0][0].where
    expect(where.OR).toEqual([
      { name: { contains: 'acme' } },
      { code: { contains: 'acme' } },
      { contactPerson: { contains: 'acme' } },
    ])
  })

  it('maps the legacy lowercase status filter onto the enum', async () => {
    mockAuth()
    vi.mocked(prisma.supplier.count).mockResolvedValue(0)
    vi.mocked(prisma.supplier.findMany).mockResolvedValue([])

    await suppliersGET(makeReq('/api/inventory/suppliers?status=blocked'))

    const where = vi.mocked(prisma.supplier.findMany).mock.calls[0][0].where
    expect(where.status).toBe(SupplierStatus.BLOCKED)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. POST /api/inventory/suppliers
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/inventory/suppliers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await suppliersPOST(makeReq('/api/inventory/suppliers', 'POST', {}))
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await suppliersPOST(makeReq('/api/inventory/suppliers', 'POST', { name: 'X' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate supplier code', async () => {
    mockAuth()
    vi.mocked(prisma.supplier.findFirst).mockResolvedValue({ id: 'existing' } as any)

    const res = await suppliersPOST(
      makeReq('/api/inventory/suppliers', 'POST', {
        code: 'SUP001',
        name: 'Acme',
        phone: '9876543210',
      })
    )
    expect(res.status).toBe(409)
  })

  it('creates supplier successfully', async () => {
    mockAuth()
    vi.mocked(prisma.supplier.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.supplier.create).mockResolvedValue({ id: 'new-id' } as any)

    const res = await suppliersPOST(
      makeReq('/api/inventory/suppliers', 'POST', {
        code: 'SUP002',
        name: 'New Supplier',
        phone: '9876543210',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.id).toBe('new-id')
    expect(vi.mocked(prisma.supplier.create).mock.calls[0][0].data.hospitalId).toBe('h1')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. GET /api/inventory/transactions
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
    vi.mocked(prisma.stockTransaction.count).mockResolvedValue(1)
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([
      {
        id: 't1',
        type: 'PURCHASE',
        quantity: 5,
        performedBy: 'u1',
        batchNumber: null,
        item: { name: 'Composite', sku: 'IT1' },
        supplier: { name: 'Acme' },
        batch: null,
      },
    ] as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'u1', name: 'Admin' }] as any)

    const res = await transactionsGET(makeReq('/api/inventory/transactions'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].itemName).toBe('Composite')
    expect(body.data[0].supplierName).toBe('Acme')
    expect(body.data[0].performedByName).toBe('Admin')
    expect(body.pagination.total).toBe(1)
  })

  it('filters by item and type', async () => {
    mockAuth()
    vi.mocked(prisma.stockTransaction.count).mockResolvedValue(0)
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([])

    await transactionsGET(makeReq('/api/inventory/transactions?itemId=i1&type=purchase'))

    const where = vi.mocked(prisma.stockTransaction.findMany).mock.calls[0][0].where
    expect(where.itemId).toBe('i1')
    expect(where.type).toBe('PURCHASE')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. POST /api/inventory/transactions
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/inventory/transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    passthroughTransaction()
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await transactionsPOST(
      makeReq('/api/inventory/transactions', 'POST', { type: 'PURCHASE' })
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found', async () => {
    mockAuth()
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(null)

    const res = await transactionsPOST(
      makeReq('/api/inventory/transactions', 'POST', {
        type: 'PURCHASE',
        itemId: 'missing',
        quantity: 5,
        transactionDate: '2026-01-01',
      })
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 for insufficient stock on sale', async () => {
    mockAuth()
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue({
      id: 'i1',
      currentStock: 2,
      minimumStock: 1,
      purchasePrice: 10,
    } as any)

    const res = await transactionsPOST(
      makeReq('/api/inventory/transactions', 'POST', {
        type: 'SALE',
        itemId: 'i1',
        quantity: 5,
        transactionDate: '2026-01-01',
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Insufficient stock')
  })

  it('creates purchase transaction and updates stock', async () => {
    mockAuth()
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue({
      id: 'i1',
      currentStock: 10,
      minimumStock: 5,
      purchasePrice: 20,
    } as any)
    vi.mocked(prisma.stockTransaction.create).mockResolvedValue({ id: 'tx1' } as any)
    vi.mocked(prisma.inventoryItem.update).mockResolvedValue({} as any)
    vi.mocked(prisma.stockAlert.deleteMany).mockResolvedValue({ count: 0 } as any)

    const res = await transactionsPOST(
      makeReq('/api/inventory/transactions', 'POST', {
        type: 'PURCHASE',
        itemId: 'i1',
        quantity: 5,
        transactionDate: '2026-01-01',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.newStock).toBe(15)

    const created = vi.mocked(prisma.stockTransaction.create).mock.calls[0][0].data
    expect(created.previousStock).toBe(10)
    expect(created.newStock).toBe(15)
    expect(created.totalPrice).toBe(100)

    expect(vi.mocked(prisma.inventoryItem.update).mock.calls[0][0].data.currentStock).toBe(15)
    // Stock is healthy again, so open shortage alerts are cleared.
    expect(prisma.stockAlert.deleteMany).toHaveBeenCalled()
  })

  it('raises a low stock alert when the new level is at or below the minimum', async () => {
    mockAuth()
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue({
      id: 'i1',
      currentStock: 6,
      minimumStock: 5,
      purchasePrice: 20,
    } as any)
    vi.mocked(prisma.stockTransaction.create).mockResolvedValue({ id: 'tx1' } as any)
    vi.mocked(prisma.inventoryItem.update).mockResolvedValue({} as any)
    vi.mocked(prisma.stockAlert.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.stockAlert.create).mockResolvedValue({ id: 'a1' } as any)

    const res = await transactionsPOST(
      makeReq('/api/inventory/transactions', 'POST', {
        type: 'CONSUMPTION',
        itemId: 'i1',
        quantity: 2,
        transactionDate: '2026-01-01',
      })
    )
    expect(res.status).toBe(201)
    expect(vi.mocked(prisma.stockAlert.create).mock.calls[0][0].data.alertType).toBe(
      StockAlertType.LOW_STOCK
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. GET /api/inventory/alerts
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
    vi.mocked(prisma.stockAlert.findMany).mockResolvedValue([
      {
        id: 'a1',
        alertType: StockAlertType.LOW_STOCK,
        isAcknowledged: false,
        item: {
          sku: 'IT1',
          name: 'Composite',
          currentStock: 2,
          minimumStock: 5,
          unit: 'box',
          category: { name: 'Materials' },
        },
        acknowledgedByUser: null,
      },
    ] as any)
    vi.mocked(prisma.stockAlert.groupBy).mockResolvedValue([
      { alertType: StockAlertType.LOW_STOCK, _count: { _all: 2 } },
      { alertType: StockAlertType.OUT_OF_STOCK, _count: { _all: 1 } },
    ] as any)

    const res = await alertsGET(makeReq('/api/inventory/alerts'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].itemName).toBe('Composite')
    expect(body.data[0].categoryName).toBe('Materials')
    expect(body.summary.totalAlerts).toBe(3)
    expect(body.summary.lowStock).toBe(2)
    expect(body.summary.outOfStock).toBe(1)
  })

  it('defaults to unacknowledged alerts', async () => {
    mockAuth()
    vi.mocked(prisma.stockAlert.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockAlert.groupBy).mockResolvedValue([])

    await alertsGET(makeReq('/api/inventory/alerts'))

    const where = vi.mocked(prisma.stockAlert.findMany).mock.calls[0][0].where
    expect(where.isAcknowledged).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. POST /api/inventory/alerts
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/inventory/alerts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when alert id missing', async () => {
    mockAuth()
    const res = await alertsPOST(makeReq('/api/inventory/alerts', 'POST', {}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when alert not found', async () => {
    mockAuth()
    vi.mocked(prisma.stockAlert.findFirst).mockResolvedValue(null)

    const res = await alertsPOST(makeReq('/api/inventory/alerts', 'POST', { alertId: 'nope' }))
    expect(res.status).toBe(404)
  })

  it('acknowledges alert successfully', async () => {
    mockAuth()
    vi.mocked(prisma.stockAlert.findFirst).mockResolvedValue({ id: 'a1' } as any)
    vi.mocked(prisma.stockAlert.update).mockResolvedValue({ id: 'a1' } as any)

    const res = await alertsPOST(
      makeReq('/api/inventory/alerts', 'POST', { alertId: 'a1', notes: 'Ordered more stock' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    const data = vi.mocked(prisma.stockAlert.update).mock.calls[0][0].data
    expect(data.isAcknowledged).toBe(true)
    expect(data.acknowledgedBy).toBe('u1')
    expect(data.notes).toBe('Ordered more stock')
  })

  it('still accepts the legacy alert_id key', async () => {
    mockAuth()
    vi.mocked(prisma.stockAlert.findFirst).mockResolvedValue({ id: 'a1' } as any)
    vi.mocked(prisma.stockAlert.update).mockResolvedValue({ id: 'a1' } as any)

    const res = await alertsPOST(makeReq('/api/inventory/alerts', 'POST', { alert_id: 'a1' }))
    expect(res.status).toBe(200)
  })
})
