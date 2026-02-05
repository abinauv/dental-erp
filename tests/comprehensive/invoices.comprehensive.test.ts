/**
 * Comprehensive Invoice/Billing API Tests
 * Tests all invoice-related endpoints with full business logic validation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock billing-utils
vi.mock('@/lib/billing-utils', () => ({
  generateInvoiceNo: vi.fn().mockResolvedValue('INV202501290001'),
  calculateInvoiceTotals: vi.fn().mockReturnValue({
    subtotal: 10000,
    discountAmount: 500,
    taxableAmount: 9500,
    cgstAmount: 427.5,
    sgstAmount: 427.5,
    totalAmount: 10355,
  }),
  gstConfig: {
    cgstRate: 9,
    sgstRate: 9,
  },
}))

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    invoice: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    patient: {
      findUnique: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    treatment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    insuranceClaim: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock auth
vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { GET, POST } from '@/app/api/invoices/route'
import { calculateInvoiceTotals, generateInvoiceNo } from '@/lib/billing-utils'

const mockPrisma = vi.mocked(prisma)
const mockRequireAuth = vi.mocked(requireAuthAndRole)
const mockCalculateTotals = vi.mocked(calculateInvoiceTotals)
const mockGenerateInvoiceNo = vi.mocked(generateInvoiceNo)

describe('Invoices API - Comprehensive Tests', () => {
  const mockHospitalId = 'hospital-123'
  const mockUserId = 'user-123'
  const mockPatientId = 'patient-123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({
      error: null,
      hospitalId: mockHospitalId,
      user: { id: mockUserId, role: 'ACCOUNTANT' },
      session: { user: { id: mockUserId, role: 'ACCOUNTANT', hospitalId: mockHospitalId } },
    })
  })

  describe('GET /api/invoices', () => {
    it('should return paginated invoices list', async () => {
      const mockInvoices = [
        {
          id: '1',
          invoiceNo: 'INV202501290001',
          totalAmount: 10355,
          status: 'PENDING',
          patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe' },
          items: [],
          payments: [],
        },
      ]

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices)
      mockPrisma.invoice.count.mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/invoices')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.invoices).toHaveLength(1)
      expect(data.pagination).toBeDefined()
    })

    it('should filter invoices by status', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/invoices?status=PAID')
      await GET(request)

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PAID',
          }),
        })
      )
    })

    it('should filter invoices by patient', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.count.mockResolvedValue(0)

      const request = new NextRequest(`http://localhost/api/invoices?patientId=${mockPatientId}`)
      await GET(request)

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: mockPatientId,
          }),
        })
      )
    })

    it('should filter invoices by date range', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/invoices?dateFrom=2025-01-01&dateTo=2025-01-31')
      await GET(request)

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            invoiceDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      )
    })

    it('should filter overdue invoices', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/invoices?overdue=true')
      await GET(request)

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: { lt: expect.any(Date) },
            status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          }),
        })
      )
    })

    it('should filter by payment method', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/invoices?paymentMethod=CASH')
      await GET(request)

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            payments: {
              some: {
                paymentMethod: 'CASH',
              },
            },
          }),
        })
      )
    })

    it('should search invoices by various fields', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/invoices?search=INV2025')
      await GET(request)

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { invoiceNo: { contains: 'INV2025' } },
            ]),
          }),
        })
      )
    })

    it('should include payment and item counts', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/invoices')
      await GET(request)

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            _count: {
              select: {
                payments: true,
                items: true,
              },
            },
          }),
        })
      )
    })
  })

  describe('POST /api/invoices', () => {
    beforeEach(() => {
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: mockPatientId,
        hospitalId: mockHospitalId,
      })
    })

    it('should create a new invoice with valid data', async () => {
      mockPrisma.invoice.create.mockResolvedValue({
        id: 'inv-1',
        invoiceNo: 'INV202501290001',
        totalAmount: 10355,
        status: 'DRAFT',
      })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [
            { description: 'Root Canal Treatment', quantity: 1, unitPrice: 10000 },
          ],
          discountType: 'FIXED',
          discountValue: 500,
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.invoiceNo).toBe('INV202501290001')
    })

    it('should reject invoice without patient', async () => {
      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Patient is required')
    })

    it('should reject invoice without items', async () => {
      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('At least one item is required')
    })

    it('should reject invoice for non-existent patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: 'non-existent',
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Patient not found')
    })

    it('should validate item data', async () => {
      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [
            { description: '', quantity: 0, unitPrice: -100 }, // Invalid
          ],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid item data')
    })

    it('should calculate GST correctly', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 10000 }],
          cgstRate: 9,
          sgstRate: 9,
        }),
      })
      await POST(request)

      expect(mockCalculateTotals).toHaveBeenCalled()
      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cgstRate: 9,
            sgstRate: 9,
            cgstAmount: 427.5,
            sgstAmount: 427.5,
          }),
        })
      )
    })

    it('should handle percentage discount', async () => {
      mockCalculateTotals.mockReturnValueOnce({
        subtotal: 10000,
        discountAmount: 1000, // 10%
        taxableAmount: 9000,
        cgstAmount: 810,
        sgstAmount: 810,
        totalAmount: 10620,
      })
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 10000 }],
          discountType: 'PERCENTAGE',
          discountValue: 10,
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountType: 'PERCENTAGE',
            discountValue: 10,
          }),
        })
      )
    })

    it('should calculate due date from payment terms', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
          paymentTermDays: 30,
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dueDate: expect.any(Date),
          }),
        })
      )
    })

    it('should handle explicit due date', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
          dueDate: '2025-02-28',
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dueDate: expect.any(Date),
          }),
        })
      )
    })

    it('should create invoice items with treatment links', async () => {
      const mockTreatmentId = 'treatment-123'
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [
            {
              description: 'Root Canal',
              quantity: 1,
              unitPrice: 5000,
              treatmentId: mockTreatmentId,
            },
          ],
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  treatmentId: mockTreatmentId,
                }),
              ]),
            },
          }),
        })
      )
    })

    it('should handle taxable and non-taxable items', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [
            { description: 'Taxable Service', quantity: 1, unitPrice: 1000, taxable: true },
            { description: 'Non-taxable Item', quantity: 1, unitPrice: 500, taxable: false },
          ],
        }),
      })
      await POST(request)

      expect(mockCalculateTotals).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ taxable: true }),
          expect.objectContaining({ taxable: false }),
        ]),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      )
    })

    it('should set initial paidAmount to 0', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paidAmount: 0,
          }),
        })
      )
    })

    it('should set balanceAmount equal to totalAmount', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalAmount: 10355,
            balanceAmount: 10355,
          }),
        })
      )
    })
  })

  describe('Permission Checks', () => {
    it('should reject invoice creation by unauthorized roles', async () => {
      mockRequireAuth.mockResolvedValue({
        error: null,
        hospitalId: mockHospitalId,
        user: { id: mockUserId, role: 'LAB_TECH' },
        session: { user: { id: mockUserId, role: 'LAB_TECH', hospitalId: mockHospitalId } },
      })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(403)
    })

    it('should allow ADMIN to create invoices', async () => {
      mockRequireAuth.mockResolvedValue({
        error: null,
        hospitalId: mockHospitalId,
        user: { id: mockUserId, role: 'ADMIN' },
        session: { user: { id: mockUserId, role: 'ADMIN', hospitalId: mockHospitalId } },
      })

      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should allow ACCOUNTANT to create invoices', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should allow RECEPTIONIST to create invoices', async () => {
      mockRequireAuth.mockResolvedValue({
        error: null,
        hospitalId: mockHospitalId,
        user: { id: mockUserId, role: 'RECEPTIONIST' },
        session: { user: { id: mockUserId, role: 'RECEPTIONIST', hospitalId: mockHospitalId } },
      })

      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })

  describe('Invoice Status Lifecycle', () => {
    const validStatuses = ['DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']

    it('should have defined statuses', () => {
      expect(validStatuses).toHaveLength(7)
    })

    it('should set default status to DRAFT', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
          }),
        })
      )
    })

    it('should allow custom initial status', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
          status: 'PENDING',
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      )
    })
  })

  describe('GST Calculations', () => {
    it('should apply default GST rates', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
          // No GST rates specified - should use defaults
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cgstRate: 9, // Default from gstConfig
            sgstRate: 9,
          }),
        })
      )
    })

    it('should allow custom GST rates', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
          cgstRate: 6,
          sgstRate: 6,
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cgstRate: 6,
            sgstRate: 6,
          }),
        })
      )
    })

    it('should handle zero GST for exempt items', async () => {
      mockCalculateTotals.mockReturnValueOnce({
        subtotal: 1000,
        discountAmount: 0,
        taxableAmount: 0, // No taxable amount
        cgstAmount: 0,
        sgstAmount: 0,
        totalAmount: 1000,
      })
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Exempt Service', quantity: 1, unitPrice: 1000, taxable: false }],
        }),
      })
      await POST(request)

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cgstAmount: 0,
            sgstAmount: 0,
          }),
        })
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large invoice amounts', async () => {
      mockCalculateTotals.mockReturnValueOnce({
        subtotal: 10000000,
        discountAmount: 0,
        taxableAmount: 10000000,
        cgstAmount: 900000,
        sgstAmount: 900000,
        totalAmount: 11800000,
      })
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Major Surgery', quantity: 1, unitPrice: 10000000 }],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle many line items', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const items = Array.from({ length: 50 }, (_, i) => ({
        description: `Item ${i + 1}`,
        quantity: 1,
        unitPrice: 100,
      }))

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle decimal quantities', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: 'Partial Service', quantity: 0.5, unitPrice: 1000 }],
        }),
      })
      const response = await POST(request)

      // Should handle or reject based on business rules
      expect([201, 400]).toContain(response.status)
    })

    it('should handle very long description', async () => {
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' })

      const longDescription = 'A'.repeat(1000)

      const request = new NextRequest('http://localhost/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          items: [{ description: longDescription, quantity: 1, unitPrice: 100 }],
        }),
      })
      const response = await POST(request)

      expect([201, 400]).toContain(response.status)
    })

    it('should handle concurrent invoice creation', async () => {
      // Multiple invoices being created simultaneously should get unique numbers
      mockGenerateInvoiceNo
        .mockResolvedValueOnce('INV202501290001')
        .mockResolvedValueOnce('INV202501290002')
        .mockResolvedValueOnce('INV202501290003')

      mockPrisma.invoice.create
        .mockResolvedValueOnce({ id: 'inv-1', invoiceNo: 'INV202501290001' })
        .mockResolvedValueOnce({ id: 'inv-2', invoiceNo: 'INV202501290002' })
        .mockResolvedValueOnce({ id: 'inv-3', invoiceNo: 'INV202501290003' })

      const requests = Array.from({ length: 3 }, () =>
        new NextRequest('http://localhost/api/invoices', {
          method: 'POST',
          body: JSON.stringify({
            patientId: mockPatientId,
            items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
          }),
        })
      )

      const responses = await Promise.all(requests.map(req => POST(req)))
      const data = await Promise.all(responses.map(res => res.json()))

      // Each should get unique invoice number
      const invoiceNos = data.map(d => d.invoiceNo)
      expect(new Set(invoiceNos).size).toBe(3)
    })
  })
})
