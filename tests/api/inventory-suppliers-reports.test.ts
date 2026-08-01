// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PurchaseOrderStatus, SupplierStatus } from '@prisma/client'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  GET as supplierDetailGET,
  PUT as supplierDetailPUT,
  DELETE as supplierDetailDELETE,
} from '@/app/api/inventory/suppliers/[id]/route'
import { GET as reportsGET } from '@/app/api/inventory/reports/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '../__mocks__/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(url: string, init?: RequestInit) {
  const req = new Request(`http://localhost${url}`, init) as any
  req.nextUrl = new URL(`http://localhost${url}`)
  return req
}

const ctx = { params: Promise.resolve({ id: 'sup-1' }) }

function authed() {
  ;(requireAuthAndRole as any).mockResolvedValue({
    error: null,
    hospitalId: 'hospital-1',
    session: { user: { id: 'user-1', role: 'ADMIN' } },
  })
}

function unauthed() {
  ;(requireAuthAndRole as any).mockResolvedValue({
    error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    hospitalId: null,
    session: null,
  })
}

const supplier = {
  id: 'sup-1',
  hospitalId: 'hospital-1',
  code: 'SUP001',
  name: 'Dental Supplies Co',
  status: SupplierStatus.ACTIVE,
  deletedAt: null,
}

describe('Inventory supplier detail and reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authed()
  })

  describe('GET /api/inventory/suppliers/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      unauthed()
      const res = await supplierDetailGET(makeReq('/api/inventory/suppliers/sup-1'), ctx)
      expect(res.status).toBe(401)
    })

    it('returns 404 when supplier not found', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null)
      const res = await supplierDetailGET(makeReq('/api/inventory/suppliers/sup-1'), ctx)
      expect(res.status).toBe(404)
    })

    it('returns supplier detail with items and purchase orders', async () => {
      prisma.supplier.findFirst.mockResolvedValue(supplier)
      prisma.inventoryItem.findMany.mockResolvedValue([
        { id: 'item-1', sku: 'IT1', name: 'Composite', currentStock: 5, purchasePrice: 100 },
      ])
      prisma.purchaseOrder.findMany.mockResolvedValue([
        { id: 'po-1', totalAmount: 1000, status: PurchaseOrderStatus.RECEIVED },
        { id: 'po-2', totalAmount: 500, status: PurchaseOrderStatus.ORDERED },
      ])

      const res = await supplierDetailGET(makeReq('/api/inventory/suppliers/sup-1'), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.itemsSupplied).toBe(1)
      expect(body.data.totalOrders).toBe(2)
      // RECEIVED counts as completed business, ORDERED as still pending.
      expect(body.data.completedBusiness).toBe(1000)
      expect(body.data.pendingBusiness).toBe(500)
      expect(body.data.itemsSuppliedList).toHaveLength(1)
      expect(body.data.recentPurchaseOrders).toHaveLength(2)
    })
  })

  describe('PUT /api/inventory/suppliers/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      unauthed()
      const res = await supplierDetailPUT(
        makeReq('/api/inventory/suppliers/sup-1', {
          method: 'PUT',
          body: JSON.stringify({ name: 'X' }),
        }),
        ctx
      )
      expect(res.status).toBe(401)
    })

    it('returns 404 when supplier not found', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null)
      const res = await supplierDetailPUT(
        makeReq('/api/inventory/suppliers/sup-1', {
          method: 'PUT',
          body: JSON.stringify({ name: 'X' }),
        }),
        ctx
      )
      expect(res.status).toBe(404)
    })

    it('returns 409 when the code conflicts with another supplier', async () => {
      prisma.supplier.findFirst
        .mockResolvedValueOnce({ id: 'sup-1', code: 'SUP001' })
        .mockResolvedValueOnce({ id: 'sup-2' })

      const res = await supplierDetailPUT(
        makeReq('/api/inventory/suppliers/sup-1', {
          method: 'PUT',
          body: JSON.stringify({ code: 'SUP002', name: 'X', phone: '1' }),
        }),
        ctx
      )
      expect(res.status).toBe(409)
    })

    it('updates supplier successfully', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1', code: 'SUP001' })
      prisma.supplier.update.mockResolvedValue({ id: 'sup-1' })

      const res = await supplierDetailPUT(
        makeReq('/api/inventory/suppliers/sup-1', {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated', status: 'blocked' }),
        }),
        ctx
      )
      expect(res.status).toBe(200)
      const data = prisma.supplier.update.mock.calls[0][0].data
      expect(data.name).toBe('Updated')
      // Legacy lowercase status is still accepted and mapped onto the enum.
      expect(data.status).toBe(SupplierStatus.BLOCKED)
    })
  })

  describe('DELETE /api/inventory/suppliers/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      unauthed()
      const res = await supplierDetailDELETE(makeReq('/api/inventory/suppliers/sup-1'), ctx)
      expect(res.status).toBe(401)
    })

    it('returns 404 when supplier not found', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null)
      const res = await supplierDetailDELETE(makeReq('/api/inventory/suppliers/sup-1'), ctx)
      expect(res.status).toBe(404)
    })

    it('soft deletes a supplier that is still referenced', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' })
      prisma.purchaseOrder.count.mockResolvedValue(2)
      prisma.inventoryItem.count.mockResolvedValue(0)
      prisma.supplier.update.mockResolvedValue({ id: 'sup-1' })

      const res = await supplierDetailDELETE(makeReq('/api/inventory/suppliers/sup-1'), ctx)
      expect(res.status).toBe(200)
      expect(prisma.supplier.delete).not.toHaveBeenCalled()
      const data = prisma.supplier.update.mock.calls[0][0].data
      expect(data.deletedAt).toBeInstanceOf(Date)
      expect(data.status).toBe(SupplierStatus.INACTIVE)
    })

    it('hard deletes a supplier with no references', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' })
      prisma.purchaseOrder.count.mockResolvedValue(0)
      prisma.inventoryItem.count.mockResolvedValue(0)
      prisma.supplier.delete.mockResolvedValue({ id: 'sup-1' })

      const res = await supplierDetailDELETE(makeReq('/api/inventory/suppliers/sup-1'), ctx)
      expect(res.status).toBe(200)
      expect(prisma.supplier.delete).toHaveBeenCalledWith({ where: { id: 'sup-1' } })
      expect(prisma.supplier.update).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/inventory/reports', () => {
    it('returns 401 when unauthenticated', async () => {
      unauthed()
      const res = await reportsGET(makeReq('/api/inventory/reports'))
      expect(res.status).toBe(401)
    })

    it('returns the summary report by default', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        {
          isActive: true,
          currentStock: 10,
          minimumStock: 5,
          purchasePrice: 100,
          itemType: 'DENTAL_MATERIAL',
          category: { id: 'cat-1', name: 'Materials' },
        },
        {
          isActive: true,
          currentStock: 0,
          minimumStock: 5,
          purchasePrice: 50,
          itemType: 'INSTRUMENT',
          category: null,
        },
      ])
      prisma.supplier.count.mockResolvedValue(3)
      prisma.stockAlert.count.mockResolvedValue(4)

      const res = await reportsGET(makeReq('/api/inventory/reports'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.summary.totalItems).toBe(2)
      expect(body.data.summary.outOfStockItems).toBe(1)
      expect(body.data.summary.totalInventoryValue).toBe(1000)
      expect(body.data.summary.activeSuppliers).toBe(3)
      expect(body.data.summary.pendingAlerts).toBe(4)
      expect(body.data.categoryBreakdown).toHaveLength(2)
      expect(body.data.typeBreakdown).toHaveLength(2)
    })

    it('returns the low stock report', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: 'i1',
          sku: 'A',
          name: 'Low one',
          currentStock: 1,
          minimumStock: 5,
          reorderLevel: 10,
          unit: 'box',
          purchasePrice: 10,
          category: { name: 'Materials' },
          preferredSupplier: { name: 'Acme', phone: '123' },
        },
        {
          id: 'i2',
          sku: 'B',
          name: 'Healthy',
          currentStock: 50,
          minimumStock: 5,
          reorderLevel: 10,
          unit: 'box',
          purchasePrice: 10,
          category: null,
          preferredSupplier: null,
        },
      ])

      const res = await reportsGET(makeReq('/api/inventory/reports?type=low_stock'))
      expect(res.status).toBe(200)
      const body = await res.json()
      // Only the item at or below its reorder level is reported.
      expect(body.data).toHaveLength(1)
      expect(body.data[0].urgency).toBe('critical')
      expect(body.data[0].suggestedOrderQuantity).toBe(9)
    })

    it('returns the expiring items report', async () => {
      const soon = new Date()
      soon.setDate(soon.getDate() + 5)

      prisma.inventoryBatch.findMany.mockResolvedValue([
        {
          batchNumber: 'B1',
          expiryDate: soon,
          remainingQty: 4,
          item: { id: 'i1', sku: 'A', name: 'Anaesthetic', unit: 'vial', purchasePrice: 25 },
        },
      ])

      const res = await reportsGET(makeReq('/api/inventory/reports?type=expiring'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.items).toHaveLength(1)
      expect(body.data.items[0].urgency).toBe('critical')
      expect(body.data.items[0].valueAtRisk).toBe(100)
      expect(body.data.summary.expiringSoonBatches).toBe(1)
    })

    it('returns the stock valuation report', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: 'i1',
          sku: 'A',
          name: 'One',
          currentStock: 2,
          unit: 'box',
          purchasePrice: 100,
          itemType: 'CONSUMABLE',
          category: { name: 'C' },
        },
      ])

      const res = await reportsGET(makeReq('/api/inventory/reports?type=stock_valuation'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.totals.totalValue).toBe(200)
      expect(body.data.totals.itemsInStock).toBe(1)
      expect(body.data.items[0].stockValue).toBe(200)
    })

    it('returns the dead stock report', async () => {
      const old = new Date()
      old.setDate(old.getDate() - 200)

      prisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: 'i1',
          sku: 'A',
          name: 'Stale',
          currentStock: 3,
          unit: 'box',
          purchasePrice: 10,
          category: null,
          stockTransactions: [{ transactionDate: old }],
        },
        {
          id: 'i2',
          sku: 'B',
          name: 'Fresh',
          currentStock: 3,
          unit: 'box',
          purchasePrice: 10,
          category: null,
          stockTransactions: [{ transactionDate: new Date() }],
        },
      ])

      const res = await reportsGET(makeReq('/api/inventory/reports?type=dead_stock'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].name).toBe('Stale')
    })

    it('returns the stock movement report', async () => {
      prisma.stockTransaction.findMany.mockResolvedValue([
        {
          type: 'PURCHASE',
          quantity: 10,
          item: { id: 'i1', sku: 'A', name: 'One', currentStock: 10, unit: 'box' },
        },
        {
          type: 'CONSUMPTION',
          quantity: 4,
          item: { id: 'i1', sku: 'A', name: 'One', currentStock: 10, unit: 'box' },
        },
      ])

      const res = await reportsGET(
        makeReq('/api/inventory/reports?type=movement&startDate=2026-01-01&endDate=2026-02-01')
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].totalIn).toBe(10)
      expect(body.data[0].totalOut).toBe(4)
      expect(body.data[0].transactionCount).toBe(2)
    })

    it('returns 400 for a movement report without dates', async () => {
      const res = await reportsGET(makeReq('/api/inventory/reports?type=movement'))
      expect(res.status).toBe(400)
    })

    it('returns 400 for an invalid report type', async () => {
      const res = await reportsGET(makeReq('/api/inventory/reports?type=nope'))
      expect(res.status).toBe(400)
    })
  })
})
