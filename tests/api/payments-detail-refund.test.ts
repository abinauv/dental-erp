import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const detailModule = await import('@/app/api/payments/[id]/route')
const refundModule = await import('@/app/api/payments/[id]/refund/route')

function makeRequest(method: string, body?: any) {
  return new Request('http://localhost/api/payments/pay-1', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

const ctx = { params: Promise.resolve({ id: 'pay-1' }) }

describe('Payments Detail & Refund API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  // ─── GET /api/payments/[id] ───────────────────────────
  describe('GET /api/payments/[id]', () => {
    it('returns payment with invoice and patient details', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay-1',
        amount: 1000,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        invoice: {
          id: 'inv-1',
          invoiceNo: 'INV001',
          totalAmount: 2000,
          paidAmount: 1000,
          balanceAmount: 1000,
          status: 'PARTIALLY_PAID',
          patient: {
            id: 'p1',
            patientId: 'PAT001',
            firstName: 'John',
            lastName: 'Doe',
            phone: '9876543210',
            email: 'john@test.com',
          },
        },
      })

      const res = await detailModule.GET(makeRequest('GET'), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.amount).toBe(1000)
      expect(body.invoice.patient.firstName).toBe('John')
    })

    it('returns 404 when payment not found', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue(null)

      const res = await detailModule.GET(makeRequest('GET'), ctx)
      expect(res.status).toBe(404)
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
        session: null,
      })

      const res = await detailModule.GET(makeRequest('GET'), ctx)
      expect(res.status).toBe(401)
    })
  })

  // ─── PUT /api/payments/[id] ───────────────────────────
  describe('PUT /api/payments/[id]', () => {
    it('updates payment notes', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
        amount: 1000,
        invoice: { paidAmount: 0, totalAmount: 2000, status: 'PENDING' },
      })
      ;(prisma.payment.update as any).mockResolvedValue({
        id: 'pay-1',
        notes: 'Updated note',
        invoice: { id: 'inv-1', invoiceNo: 'INV001', totalAmount: 2000, paidAmount: 0, balanceAmount: 2000, status: 'PENDING' },
      })

      const res = await detailModule.PUT(makeRequest('PUT', { notes: 'Updated note' }), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.notes).toBe('Updated note')
    })

    it('completes a pending payment and updates invoice', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
        amount: 2000,
        invoiceId: 'inv-1',
        invoice: { paidAmount: 0, totalAmount: 2000, status: 'PENDING' },
      })
      ;(prisma.invoice.update as any).mockResolvedValue({})
      ;(prisma.payment.update as any).mockResolvedValue({
        id: 'pay-1',
        status: 'COMPLETED',
        invoice: { id: 'inv-1', status: 'PAID' },
      })

      const res = await detailModule.PUT(makeRequest('PUT', { status: 'COMPLETED' }), ctx)
      expect(res.status).toBe(200)
      expect(prisma.invoice.update).toHaveBeenCalled()
    })

    it('rejects changing status of completed payment', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay-1',
        status: 'COMPLETED',
        amount: 1000,
        invoice: { paidAmount: 1000, totalAmount: 1000, status: 'PAID' },
      })

      const res = await detailModule.PUT(makeRequest('PUT', { status: 'CANCELLED' }), ctx)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('refund')
    })

    it('returns 400 when no valid fields to update', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
        amount: 1000,
        invoice: { paidAmount: 0, totalAmount: 1000, status: 'PENDING' },
      })

      const res = await detailModule.PUT(makeRequest('PUT', {}), ctx)
      expect(res.status).toBe(400)
    })

    it('returns 403 for non-ADMIN/ACCOUNTANT roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'RECEPTIONIST' } },
      })

      const res = await detailModule.PUT(makeRequest('PUT', { notes: 'test' }), ctx)
      expect(res.status).toBe(403)
    })

    it('returns 404 when payment not found', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue(null)

      const res = await detailModule.PUT(makeRequest('PUT', { notes: 'test' }), ctx)
      expect(res.status).toBe(404)
    })
  })

  // ─── DELETE /api/payments/[id] ────────────────────────
  describe('DELETE /api/payments/[id]', () => {
    it('deletes a pending payment', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
      })
      ;(prisma.payment.delete as any).mockResolvedValue({})

      const res = await detailModule.DELETE(makeRequest('DELETE'), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('deleted')
    })

    it('rejects deleting completed payment', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay-1',
        status: 'COMPLETED',
      })

      const res = await detailModule.DELETE(makeRequest('DELETE'), ctx)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('refund')
    })

    it('returns 404 when payment not found', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue(null)

      const res = await detailModule.DELETE(makeRequest('DELETE'), ctx)
      expect(res.status).toBe(404)
    })

    it('returns 403 for non-ADMIN roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'ACCOUNTANT' } },
      })

      const res = await detailModule.DELETE(makeRequest('DELETE'), ctx)
      expect(res.status).toBe(403)
    })
  })

  // ─── POST /api/payments/[id]/refund ───────────────────
  describe('POST /api/payments/[id]/refund', () => {
    it('processes full refund successfully', async () => {
      ;(prisma.payment.findUnique as any)
        .mockResolvedValueOnce({
          id: 'pay-1',
          status: 'COMPLETED',
          amount: 1000,
          refundAmount: null,
          invoiceId: 'inv-1',
          invoice: { paidAmount: 1000, totalAmount: 1000, status: 'PAID' },
        })
        .mockResolvedValueOnce({
          id: 'pay-1',
          status: 'REFUNDED',
          refundAmount: 1000,
          invoice: { id: 'inv-1', invoiceNo: 'INV001', totalAmount: 1000, paidAmount: 0, balanceAmount: 1000, status: 'REFUNDED' },
        })
      ;(prisma.payment.update as any).mockResolvedValue({})
      ;(prisma.invoice.update as any).mockResolvedValue({})

      const res = await refundModule.POST(
        makeRequest('POST', { refundAmount: 1000, refundReason: 'Patient request' }),
        ctx
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('Refund processed')
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REFUNDED' }),
        })
      )
    })

    it('processes partial refund', async () => {
      ;(prisma.payment.findUnique as any)
        .mockResolvedValueOnce({
          id: 'pay-1',
          status: 'COMPLETED',
          amount: 1000,
          refundAmount: null,
          invoiceId: 'inv-1',
          invoice: { paidAmount: 1000, totalAmount: 1000, status: 'PAID' },
        })
        .mockResolvedValueOnce({
          id: 'pay-1',
          status: 'REFUNDED',
          refundAmount: 500,
        })
      ;(prisma.payment.update as any).mockResolvedValue({})
      ;(prisma.invoice.update as any).mockResolvedValue({})

      const res = await refundModule.POST(
        makeRequest('POST', { refundAmount: 500 }),
        ctx
      )
      expect(res.status).toBe(200)
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PARTIALLY_PAID' }),
        })
      )
    })

    it('returns 400 for invalid refund amount', async () => {
      const res = await refundModule.POST(
        makeRequest('POST', { refundAmount: 0 }),
        ctx
      )
      expect(res.status).toBe(400)
    })

    it('returns 400 when refund exceeds payment amount', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay-1',
        status: 'COMPLETED',
        amount: 500,
        refundAmount: null,
        invoice: { paidAmount: 500, totalAmount: 500, status: 'PAID' },
      })

      const res = await refundModule.POST(
        makeRequest('POST', { refundAmount: 1000 }),
        ctx
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('exceeds')
    })

    it('returns 400 for non-COMPLETED payment', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
        amount: 1000,
        refundAmount: null,
        invoice: {},
      })

      const res = await refundModule.POST(
        makeRequest('POST', { refundAmount: 500 }),
        ctx
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('completed')
    })

    it('returns 400 for already refunded payment', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue({
        id: 'pay-1',
        status: 'COMPLETED',
        amount: 1000,
        refundAmount: 500,
        invoice: {},
      })

      const res = await refundModule.POST(
        makeRequest('POST', { refundAmount: 500 }),
        ctx
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('already been refunded')
    })

    it('returns 404 when payment not found', async () => {
      ;(prisma.payment.findUnique as any).mockResolvedValue(null)

      const res = await refundModule.POST(
        makeRequest('POST', { refundAmount: 500 }),
        ctx
      )
      expect(res.status).toBe(404)
    })

    it('returns 403 for non-ADMIN/ACCOUNTANT roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'DOCTOR' } },
      })

      const res = await refundModule.POST(
        makeRequest('POST', { refundAmount: 500 }),
        ctx
      )
      expect(res.status).toBe(403)
    })
  })
})
