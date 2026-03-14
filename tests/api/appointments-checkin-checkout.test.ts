import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const checkInModule = await import('@/app/api/appointments/[id]/check-in/route')
const checkOutModule = await import('@/app/api/appointments/[id]/check-out/route')

function makeRequest(method: string, body?: any) {
  return new Request('http://localhost/api/appointments/apt-1/check-in', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

const ctx = { params: Promise.resolve({ id: 'apt-1' }) }

describe('Appointments Check-in & Check-out API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'RECEPTIONIST' } },
    })
  })

  // ─── POST /api/appointments/[id]/check-in ─────────
  describe('POST /api/appointments/[id]/check-in', () => {
    it('checks in a SCHEDULED appointment', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue({
        id: 'apt-1',
        status: 'SCHEDULED',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
      })
      ;(prisma.appointment.update as any).mockResolvedValue({
        id: 'apt-1',
        status: 'CHECKED_IN',
        patient: { id: 'p1', firstName: 'John', lastName: 'Doe' },
        doctor: { id: 'd1', firstName: 'Jane', lastName: 'Smith' },
      })

      const res = await checkInModule.POST(makeRequest('POST'), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('CHECKED_IN')
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CHECKED_IN' }),
        })
      )
    })

    it('checks in a CONFIRMED appointment', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue({
        id: 'apt-1',
        status: 'CONFIRMED',
        scheduledDate: new Date(),
        scheduledTime: '14:00',
      })
      ;(prisma.appointment.update as any).mockResolvedValue({
        id: 'apt-1',
        status: 'CHECKED_IN',
      })

      const res = await checkInModule.POST(makeRequest('POST'), ctx)
      expect(res.status).toBe(200)
    })

    it('rejects check-in for COMPLETED appointment', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue({
        id: 'apt-1',
        status: 'COMPLETED',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
      })

      const res = await checkInModule.POST(makeRequest('POST'), ctx)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('COMPLETED')
    })

    it('rejects check-in for CANCELLED appointment', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue({
        id: 'apt-1',
        status: 'CANCELLED',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
      })

      const res = await checkInModule.POST(makeRequest('POST'), ctx)
      expect(res.status).toBe(400)
    })

    it('returns 404 when appointment not found', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue(null)

      const res = await checkInModule.POST(makeRequest('POST'), ctx)
      expect(res.status).toBe(404)
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
        session: null,
      })

      const res = await checkInModule.POST(makeRequest('POST'), ctx)
      expect(res.status).toBe(401)
    })
  })

  // ─── POST /api/appointments/[id]/check-out ────────
  describe('POST /api/appointments/[id]/check-out', () => {
    it('checks out a CHECKED_IN appointment', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue({
        id: 'apt-1',
        status: 'CHECKED_IN',
        notes: null,
      })
      ;(prisma.appointment.update as any).mockResolvedValue({
        id: 'apt-1',
        status: 'COMPLETED',
        patient: { id: 'p1', firstName: 'John', lastName: 'Doe' },
        doctor: { id: 'd1', firstName: 'Jane', lastName: 'Smith' },
      })

      const res = await checkOutModule.POST(makeRequest('POST'), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('COMPLETED')
    })

    it('checks out an IN_PROGRESS appointment with notes', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue({
        id: 'apt-1',
        status: 'IN_PROGRESS',
        notes: 'Existing notes',
      })
      ;(prisma.appointment.update as any).mockResolvedValue({
        id: 'apt-1',
        status: 'COMPLETED',
      })

      const res = await checkOutModule.POST(
        makeRequest('POST', { notes: 'Treatment completed' }),
        ctx
      )
      expect(res.status).toBe(200)
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            notes: expect.stringContaining('Existing notes'),
          }),
        })
      )
    })

    it('rejects check-out for SCHEDULED appointment', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue({
        id: 'apt-1',
        status: 'SCHEDULED',
      })

      const res = await checkOutModule.POST(makeRequest('POST'), ctx)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('SCHEDULED')
    })

    it('returns 404 when appointment not found', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue(null)

      const res = await checkOutModule.POST(makeRequest('POST'), ctx)
      expect(res.status).toBe(404)
    })
  })
})
