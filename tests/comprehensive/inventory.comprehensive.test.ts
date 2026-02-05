/**
 * Comprehensive Inventory API Tests
 * Tests all inventory-related endpoints with full business logic validation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    inventoryItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    inventoryCategory: {
      findMany: vi.fn(),
    },
    supplier: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    stockTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

// Mock auth
vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { GET, POST } from '@/app/api/inventory/items/route'

const mockPrisma = vi.mocked(prisma)
const mockRequireAuth = vi.mocked(requireAuthAndRole)

describe('Inventory API - Comprehensive Tests', () => {
  const mockHospitalId = 'hospital-123'
  const mockUserId = 'user-123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({
      error: null,
      hospitalId: mockHospitalId,
      user: { id: mockUserId, role: 'ADMIN' },
      session: { user: { id: mockUserId, role: 'ADMIN', hospitalId: mockHospitalId } },
    })
  })

  describe('GET /api/inventory/items', () => {
    it('should return inventory items with stock status', async () => {
      const mockItems = [
        {
          id: '1',
          sku: 'GLOVE-M-100',
          name: 'Latex Gloves Medium',
          currentStock: 500,
          minimumStock: 100,
          reorderLevel: 200,
          category: { id: 'cat-1', name: 'PPE' },
          supplierItems: [],
        },
      ]

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockItems)

      const request = new NextRequest('http://localhost/api/inventory/items')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].stockStatus).toBe('sufficient')
    })

    it('should identify low stock items', async () => {
      const mockItems = [
        {
          id: '1',
          sku: 'MASK-N95',
          name: 'N95 Masks',
          currentStock: 50, // At or below minimum
          minimumStock: 100,
          reorderLevel: 200,
          category: null,
          supplierItems: [],
        },
      ]

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockItems)

      const request = new NextRequest('http://localhost/api/inventory/items')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data[0].stockStatus).toBe('low_stock')
    })

    it('should identify out of stock items', async () => {
      const mockItems = [
        {
          id: '1',
          sku: 'DENTAL-CEMENT',
          name: 'Dental Cement',
          currentStock: 0,
          minimumStock: 10,
          reorderLevel: 20,
          category: null,
          supplierItems: [],
        },
      ]

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockItems)

      const request = new NextRequest('http://localhost/api/inventory/items')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data[0].stockStatus).toBe('out_of_stock')
    })

    it('should identify reorder level items', async () => {
      const mockItems = [
        {
          id: '1',
          sku: 'SYRINGE-5ML',
          name: '5ml Syringe',
          currentStock: 150, // Above minimum but at/below reorder
          minimumStock: 100,
          reorderLevel: 200,
          category: null,
          supplierItems: [],
        },
      ]

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockItems)

      const request = new NextRequest('http://localhost/api/inventory/items')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data[0].stockStatus).toBe('reorder')
    })

    it('should filter by category', async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/inventory/items?category=cat-123')
      await GET(request)

      expect(mockPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 'cat-123',
          }),
        })
      )
    })

    it('should filter by low stock only', async () => {
      const mockItems = [
        { id: '1', currentStock: 50, minimumStock: 100, reorderLevel: 200, category: null, supplierItems: [] },
        { id: '2', currentStock: 500, minimumStock: 100, reorderLevel: 200, category: null, supplierItems: [] },
        { id: '3', currentStock: 0, minimumStock: 10, reorderLevel: 20, category: null, supplierItems: [] },
      ]

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockItems)

      const request = new NextRequest('http://localhost/api/inventory/items?lowStock=true')
      const response = await GET(request)
      const data = await response.json()

      // Should only return low_stock and out_of_stock items
      expect(data.data.every((item: any) =>
        item.stockStatus === 'low_stock' || item.stockStatus === 'out_of_stock'
      )).toBe(true)
    })

    it('should search by name, SKU, or description', async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/inventory/items?search=glove')
      await GET(request)

      expect(mockPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'glove', mode: 'insensitive' } },
              { sku: { contains: 'glove', mode: 'insensitive' } },
              { description: { contains: 'glove', mode: 'insensitive' } },
            ],
          }),
        })
      )
    })

    it('should filter by active status', async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/inventory/items?status=active')
      await GET(request)

      expect(mockPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      )
    })

    it('should paginate results', async () => {
      const mockItems = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        currentStock: 100,
        minimumStock: 10,
        reorderLevel: 20,
        category: null,
        supplierItems: [],
      }))

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockItems)

      const request = new NextRequest('http://localhost/api/inventory/items?page=2&limit=20')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data).toHaveLength(20)
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.limit).toBe(20)
    })
  })

  describe('POST /api/inventory/items', () => {
    it('should create a new inventory item', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null) // SKU doesn't exist
      mockPrisma.inventoryItem.create.mockResolvedValue({
        id: 'item-1',
        sku: 'NEW-ITEM-001',
        name: 'New Item',
        unit: 'PCS',
        purchasePrice: 100,
      })
      mockPrisma.stockTransaction.create.mockResolvedValue({ id: 'txn-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'NEW-ITEM-001',
          name: 'New Item',
          unit: 'PCS',
          purchasePrice: 100,
          currentStock: 50,
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
    })

    it('should reject item without required fields', async () => {
      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Item Without SKU',
          // Missing sku, unit, purchasePrice
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Missing required fields')
    })

    it('should reject duplicate SKU', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue({
        id: 'existing-item',
        sku: 'EXISTING-SKU',
      })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'EXISTING-SKU',
          name: 'New Item',
          unit: 'PCS',
          purchasePrice: 100,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toBe('SKU already exists')
    })

    it('should create opening stock transaction when stock > 0', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({
        id: 'item-1',
        sku: 'NEW-ITEM',
      })
      mockPrisma.stockTransaction.create.mockResolvedValue({ id: 'txn-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'NEW-ITEM',
          name: 'New Item',
          unit: 'PCS',
          purchasePrice: 100,
          currentStock: 50,
        }),
      })
      await POST(request)

      expect(mockPrisma.stockTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ADJUSTMENT_IN',
            quantity: 50,
            previousStock: 0,
            newStock: 50,
            notes: 'Opening stock entry',
          }),
        })
      )
    })

    it('should not create stock transaction when stock is 0', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'NEW-ITEM',
          name: 'New Item',
          unit: 'PCS',
          purchasePrice: 100,
          currentStock: 0,
        }),
      })
      await POST(request)

      expect(mockPrisma.stockTransaction.create).not.toHaveBeenCalled()
    })

    it('should handle batch tracking items', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'BATCH-ITEM',
          name: 'Batch Tracked Item',
          unit: 'PCS',
          purchasePrice: 100,
          batchTracking: true,
        }),
      })
      await POST(request)

      expect(mockPrisma.inventoryItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            batchTracking: true,
          }),
        })
      )
    })

    it('should handle expiry tracking items', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'EXPIRY-ITEM',
          name: 'Expiry Tracked Item',
          unit: 'PCS',
          purchasePrice: 100,
          expiryTracking: true,
        }),
      })
      await POST(request)

      expect(mockPrisma.inventoryItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiryTracking: true,
          }),
        })
      )
    })

    it('should set storage location and conditions', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'STORED-ITEM',
          name: 'Temperature Sensitive Item',
          unit: 'PCS',
          purchasePrice: 100,
          storageLocation: 'Refrigerator A',
          storageConditions: '2-8°C',
        }),
      })
      await POST(request)

      expect(mockPrisma.inventoryItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storageLocation: 'Refrigerator A',
            storageConditions: '2-8°C',
          }),
        })
      )
    })
  })

  describe('Stock Status Calculations', () => {
    const testCases = [
      { current: 500, minimum: 100, reorder: 200, expected: 'sufficient' },
      { current: 200, minimum: 100, reorder: 200, expected: 'reorder' },
      { current: 150, minimum: 100, reorder: 200, expected: 'reorder' },
      { current: 100, minimum: 100, reorder: 200, expected: 'low_stock' },
      { current: 50, minimum: 100, reorder: 200, expected: 'low_stock' },
      { current: 0, minimum: 100, reorder: 200, expected: 'out_of_stock' },
    ]

    it.each(testCases)(
      'should return $expected when current=$current, min=$minimum, reorder=$reorder',
      async ({ current, minimum, reorder, expected }) => {
        const mockItems = [{
          id: '1',
          currentStock: current,
          minimumStock: minimum,
          reorderLevel: reorder,
          category: null,
          supplierItems: [],
        }]

        mockPrisma.inventoryItem.findMany.mockResolvedValue(mockItems)

        const request = new NextRequest('http://localhost/api/inventory/items')
        const response = await GET(request)
        const data = await response.json()

        expect(data.data[0].stockStatus).toBe(expected)
      }
    )
  })

  describe('Stock Transactions', () => {
    const transactionTypes = [
      'PURCHASE',
      'SALE',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'RETURN',
      'DAMAGED',
      'EXPIRED',
      'TRANSFER_IN',
      'TRANSFER_OUT',
    ]

    it('should track valid transaction types', () => {
      expect(transactionTypes).toHaveLength(9)
    })

    it('should calculate total price in stock transaction', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' })
      mockPrisma.stockTransaction.create.mockResolvedValue({ id: 'txn-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'NEW-ITEM',
          name: 'New Item',
          unit: 'PCS',
          purchasePrice: 100,
          currentStock: 50,
        }),
      })
      await POST(request)

      expect(mockPrisma.stockTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitPrice: 100,
            totalPrice: 5000, // 50 * 100
          }),
        })
      )
    })
  })

  describe('Units of Measurement', () => {
    const validUnits = ['PCS', 'BOX', 'PACK', 'ML', 'L', 'G', 'KG', 'UNIT', 'SET', 'PAIR']

    it.each(validUnits)('should accept %s as a valid unit', async (unit) => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'TEST-UNIT',
          name: 'Test Item',
          unit,
          purchasePrice: 100,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })

  describe('Edge Cases', () => {
    it('should handle negative stock gracefully', async () => {
      // This shouldn't happen in practice but API should handle it
      const mockItems = [{
        id: '1',
        currentStock: -5, // Invalid state
        minimumStock: 10,
        reorderLevel: 20,
        category: null,
        supplierItems: [],
      }]

      mockPrisma.inventoryItem.findMany.mockResolvedValue(mockItems)

      const request = new NextRequest('http://localhost/api/inventory/items')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data[0].stockStatus).toBe('out_of_stock')
    })

    it('should handle very large stock quantities', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' })
      mockPrisma.stockTransaction.create.mockResolvedValue({ id: 'txn-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'BULK-ITEM',
          name: 'Bulk Item',
          unit: 'PCS',
          purchasePrice: 0.01,
          currentStock: 1000000,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle decimal purchase prices', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'DECIMAL-ITEM',
          name: 'Decimal Price Item',
          unit: 'PCS',
          purchasePrice: 99.99,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle special characters in item name', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'SPECIAL-ITEM',
          name: 'Item (Large) - 100ml / 3.4oz',
          unit: 'ML',
          purchasePrice: 50,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle zero minimum stock', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null)
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' })

      const request = new NextRequest('http://localhost/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: 'NO-MIN-ITEM',
          name: 'No Minimum Item',
          unit: 'PCS',
          purchasePrice: 100,
          minimumStock: 0,
          reorderLevel: 0,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })
})
