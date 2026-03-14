import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const shiftsModule = await import('@/app/api/staff/[id]/shifts/route')

function makeRequest(method: string, body?: any) {
  return new Request('http://localhost/api/staff/staff-1/shifts', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

const ctx = { params: Promise.resolve({ id: 'staff-1' }) }

describe('Staff Shifts API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  // ─── GET /api/staff/[id]/shifts ───────────────────
  describe('GET /api/staff/[id]/shifts', () => {
    it('returns shifts for a staff member', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue({ id: 'staff-1' })
      ;(prisma.staffShift.findMany as any).mockResolvedValue([
        { id: 's1', staffId: 'staff-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
        { id: 's2', staffId: 'staff-1', dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      ])

      const res = await shiftsModule.GET(makeRequest('GET'), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.shifts).toHaveLength(2)
      expect(body.shifts[0].dayOfWeek).toBe(1)
    })

    it('returns 404 when staff not found', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue(null)

      const res = await shiftsModule.GET(makeRequest('GET'), ctx)
      expect(res.status).toBe(404)
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
        session: null,
      })

      const res = await shiftsModule.GET(makeRequest('GET'), ctx)
      expect(res.status).toBe(401)
    })
  })

  // ─── PUT /api/staff/[id]/shifts ───────────────────
  describe('PUT /api/staff/[id]/shifts', () => {
    it('replaces all shifts for a staff member', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue({ id: 'staff-1' })

      const newShifts = [
        { dayOfWeek: 1, startTime: '08:00', endTime: '16:00' },
        { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
      ]

      // $transaction mock already delegates to the callback with prisma
      ;(prisma.staffShift.deleteMany as any).mockResolvedValue({ count: 2 })
      ;(prisma.staffShift.createMany as any).mockResolvedValue({ count: 2 })
      ;(prisma.staffShift.findMany as any).mockResolvedValue(
        newShifts.map((s, i) => ({ id: `s-new-${i}`, staffId: 'staff-1', ...s, isActive: true }))
      )

      const res = await shiftsModule.PUT(makeRequest('PUT', { shifts: newShifts }), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.shifts).toHaveLength(2)
    })

    it('returns 403 for non-ADMIN role', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'DOCTOR' } },
      })

      const res = await shiftsModule.PUT(makeRequest('PUT', { shifts: [] }), ctx)
      expect(res.status).toBe(403)
    })

    it('returns 400 when shifts is not an array', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue({ id: 'staff-1' })

      const res = await shiftsModule.PUT(makeRequest('PUT', { shifts: 'invalid' }), ctx)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('array')
    })

    it('validates dayOfWeek range (0-6)', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue({ id: 'staff-1' })

      const res = await shiftsModule.PUT(
        makeRequest('PUT', { shifts: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00' }] }),
        ctx
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('dayOfWeek')
    })

    it('validates startTime and endTime required', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue({ id: 'staff-1' })

      const res = await shiftsModule.PUT(
        makeRequest('PUT', { shifts: [{ dayOfWeek: 1 }] }),
        ctx
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('startTime')
    })

    it('returns 404 when staff not found', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue(null)

      const res = await shiftsModule.PUT(
        makeRequest('PUT', { shifts: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] }),
        ctx
      )
      expect(res.status).toBe(404)
    })
  })
})
