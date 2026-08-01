import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LabOrderStatus } from '@prisma/client'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

const { prisma } = await import('../__mocks__/prisma')
const statusModule = await import('@/app/api/lab-orders/[id]/status/route')

function makeRequest(body?: any) {
  return new Request('http://localhost/api/lab-orders/order-1/status', {
    method: 'PATCH',
    ...(body
      ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
      : {}),
  }) as any
}

const ctx = { params: Promise.resolve({ id: 'order-1' }) }

/** The order as the route selects it, before any status change. */
function existingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    status: LabOrderStatus.CREATED,
    sentDate: null,
    receivedDate: null,
    deliveredDate: null,
    ...overrides,
  }
}

/** The data passed to prisma.labOrder.update in the transaction. */
function updateData() {
  return prisma.labOrder.update.mock.calls[0][0].data
}

describe('Lab Order Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
    // The route batches the update and the history insert; the mock client
    // resolves $transaction by running the array it is given.
    prisma.$transaction.mockImplementation((arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg)
    )
    prisma.labOrder.update.mockResolvedValue({ id: 'order-1' })
    prisma.labOrderHistory.create.mockResolvedValue({ id: 'history-1' })
  })

  describe('PATCH /api/lab-orders/[id]/status', () => {
    it('updates lab order status', async () => {
      prisma.labOrder.findFirst.mockResolvedValue(existingOrder())

      const res = await statusModule.PATCH(makeRequest({ status: 'in_progress' }), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('updated successfully')
      expect(updateData().status).toBe(LabOrderStatus.IN_PROGRESS)
    })

    it('auto-sets sentDate for sent_to_lab status', async () => {
      prisma.labOrder.findFirst.mockResolvedValue(existingOrder())

      const res = await statusModule.PATCH(makeRequest({ status: 'sent_to_lab' }), ctx)
      expect(res.status).toBe(200)
      expect(updateData().sentDate).toBeInstanceOf(Date)
    })

    it('auto-sets receivedDate for ready status', async () => {
      prisma.labOrder.findFirst.mockResolvedValue(
        existingOrder({ status: LabOrderStatus.IN_PROGRESS, sentDate: new Date('2026-01-01') })
      )

      const res = await statusModule.PATCH(makeRequest({ status: 'ready' }), ctx)
      expect(res.status).toBe(200)
      expect(updateData().receivedDate).toBeInstanceOf(Date)
    })

    it('auto-sets deliveredDate for fitted status', async () => {
      prisma.labOrder.findFirst.mockResolvedValue(
        existingOrder({
          status: LabOrderStatus.READY,
          sentDate: new Date('2026-01-01'),
          receivedDate: new Date('2026-01-10'),
        })
      )

      const res = await statusModule.PATCH(makeRequest({ status: 'fitted' }), ctx)
      expect(res.status).toBe(200)
      expect(updateData().deliveredDate).toBeInstanceOf(Date)
    })

    it('does not overwrite a milestone date that is already set', async () => {
      const sentDate = new Date('2026-01-01')
      prisma.labOrder.findFirst.mockResolvedValue(existingOrder({ sentDate }))

      await statusModule.PATCH(makeRequest({ status: 'sent_to_lab' }), ctx)
      expect(updateData().sentDate).toBeUndefined()
    })

    it('returns 400 when status is missing', async () => {
      const res = await statusModule.PATCH(makeRequest({}), ctx)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('required')
    })

    it('returns 400 for invalid status value', async () => {
      const res = await statusModule.PATCH(makeRequest({ status: 'INVALID_STATUS' }), ctx)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('Invalid status')
    })

    it('returns 404 when lab order not found', async () => {
      prisma.labOrder.findFirst.mockResolvedValue(null)

      const res = await statusModule.PATCH(makeRequest({ status: 'in_progress' }), ctx)
      expect(res.status).toBe(404)
    })

    it('records a history row with the supplied notes', async () => {
      prisma.labOrder.findFirst.mockResolvedValue(existingOrder())

      await statusModule.PATCH(
        makeRequest({ status: 'in_progress', notes: 'Started work on crown' }),
        ctx
      )

      expect(prisma.labOrderHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          labOrderId: 'order-1',
          statusFrom: LabOrderStatus.CREATED,
          statusTo: LabOrderStatus.IN_PROGRESS,
          changedBy: 'user-1',
          notes: 'Started work on crown',
        }),
      })
    })

    it('falls back to a generated note when none is supplied', async () => {
      prisma.labOrder.findFirst.mockResolvedValue(existingOrder())

      await statusModule.PATCH(makeRequest({ status: 'in_progress' }), ctx)

      expect(prisma.labOrderHistory.create.mock.calls[0][0].data.notes).toContain('IN_PROGRESS')
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
        session: null,
      })

      const res = await statusModule.PATCH(makeRequest({ status: 'in_progress' }), ctx)
      expect(res.status).toBe(401)
    })

    it('accepts every LabOrderStatus, in legacy lowercase form', async () => {
      for (const status of Object.values(LabOrderStatus)) {
        vi.clearAllMocks()
        mockAuth.requireAuthAndRole.mockResolvedValue({
          error: null,
          hospitalId: 'hospital-1',
          session: { user: { id: 'user-1', role: 'ADMIN' } },
        })
        prisma.$transaction.mockImplementation((arg: any) =>
          typeof arg === 'function' ? arg(prisma) : Promise.all(arg)
        )
        prisma.labOrder.findFirst.mockResolvedValue(existingOrder())
        prisma.labOrder.update.mockResolvedValue({ id: 'order-1' })
        prisma.labOrderHistory.create.mockResolvedValue({ id: 'history-1' })

        const res = await statusModule.PATCH(makeRequest({ status: status.toLowerCase() }), ctx)
        expect(res.status).toBe(200)
      }
    })
  })
})
