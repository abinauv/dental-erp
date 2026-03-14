import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockPool = vi.hoisted(() => ({
  execute: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/db', () => ({ default: mockPool }))
vi.mock('mysql2', () => ({
  RowDataPacket: class {},
}))

const statusModule = await import('@/app/api/lab-orders/[id]/status/route')

function makeRequest(body?: any) {
  return new Request('http://localhost/api/lab-orders/order-1/status', {
    method: 'PATCH',
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

const ctx = { params: Promise.resolve({ id: 'order-1' }) }

describe('Lab Order Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  describe('PATCH /api/lab-orders/[id]/status', () => {
    it('updates lab order status', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ status: 'created', sent_date: null, received_date: null, delivered_date: null }]]) // SELECT
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT history

      const res = await statusModule.PATCH(makeRequest({ status: 'in_progress' }), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('updated successfully')
    })

    it('auto-sets sent_date for sent_to_lab status', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ status: 'created', sent_date: null, received_date: null, delivered_date: null }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])

      const res = await statusModule.PATCH(makeRequest({ status: 'sent_to_lab' }), ctx)
      expect(res.status).toBe(200)

      // Verify the UPDATE query includes sent_date
      const updateCall = mockPool.execute.mock.calls[1]
      expect(updateCall[0]).toContain('sent_date')
    })

    it('auto-sets received_date for ready status', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ status: 'in_progress', sent_date: '2026-01-01', received_date: null, delivered_date: null }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])

      const res = await statusModule.PATCH(makeRequest({ status: 'ready' }), ctx)
      expect(res.status).toBe(200)
      const updateCall = mockPool.execute.mock.calls[1]
      expect(updateCall[0]).toContain('received_date')
    })

    it('auto-sets delivered_date for fitted status', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ status: 'ready', sent_date: '2026-01-01', received_date: '2026-01-10', delivered_date: null }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])

      const res = await statusModule.PATCH(makeRequest({ status: 'fitted' }), ctx)
      expect(res.status).toBe(200)
      const updateCall = mockPool.execute.mock.calls[1]
      expect(updateCall[0]).toContain('delivered_date')
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
      mockPool.execute.mockResolvedValueOnce([[]])

      const res = await statusModule.PATCH(makeRequest({ status: 'in_progress' }), ctx)
      expect(res.status).toBe(404)
    })

    it('inserts history record with notes', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ status: 'created', sent_date: null, received_date: null, delivered_date: null }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])

      await statusModule.PATCH(
        makeRequest({ status: 'in_progress', notes: 'Started work on crown' }),
        ctx
      )

      // Third execute call is the history INSERT
      const historyCall = mockPool.execute.mock.calls[2]
      expect(historyCall[1]).toContain('Started work on crown')
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

    it('accepts all 9 valid statuses', async () => {
      const validStatuses = [
        'created', 'sent_to_lab', 'in_progress', 'quality_check',
        'ready', 'delivered', 'fitted', 'remake_required', 'cancelled'
      ]

      for (const status of validStatuses) {
        vi.clearAllMocks()
        mockAuth.requireAuthAndRole.mockResolvedValue({
          error: null,
          hospitalId: 'hospital-1',
          session: { user: { id: 'user-1', role: 'ADMIN' } },
        })
        mockPool.execute
          .mockResolvedValueOnce([[{ status: 'created', sent_date: null, received_date: null, delivered_date: null }]])
          .mockResolvedValueOnce([{ affectedRows: 1 }])
          .mockResolvedValueOnce([{ affectedRows: 1 }])

        const res = await statusModule.PATCH(makeRequest({ status }), ctx)
        expect(res.status).toBe(200)
      }
    })
  })
})
