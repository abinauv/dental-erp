import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const todayModule = await import('@/app/api/appointments/today/route')
const waitlistModule = await import('@/app/api/appointments/waitlist/route')

function makeTodayRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/appointments/today')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString()) as any
}

function makeWaitlistRequest(method: string, params: Record<string, string> = {}, body?: any) {
  const url = new URL('http://localhost/api/appointments/waitlist')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return {
    url: url.toString(),
    method,
    nextUrl: { searchParams: url.searchParams },
    json: async () => body,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        }
      : { headers: new Headers() }),
  } as any
}

describe('Appointments Today & Waitlist API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  // ─── GET /api/appointments/today ──────────────────
  describe('GET /api/appointments/today', () => {
    it('returns today appointments grouped by status with stats', async () => {
      ;(prisma.appointment.findMany as any).mockResolvedValue([
        { id: 'a1', status: 'CHECKED_IN', waitTime: 10, scheduledTime: '09:00', patient: { id: 'p1' }, doctor: { id: 'd1' } },
        { id: 'a2', status: 'CHECKED_IN', waitTime: 20, scheduledTime: '09:30', patient: { id: 'p2' }, doctor: { id: 'd1' } },
        { id: 'a3', status: 'SCHEDULED', scheduledTime: '10:00', patient: { id: 'p3' }, doctor: { id: 'd1' } },
        { id: 'a4', status: 'COMPLETED', scheduledTime: '08:00', patient: { id: 'p4' }, doctor: { id: 'd1' } },
        { id: 'a5', status: 'NO_SHOW', scheduledTime: '08:30', patient: { id: 'p5' }, doctor: { id: 'd1' } },
        { id: 'a6', status: 'IN_PROGRESS', scheduledTime: '09:15', patient: { id: 'p6' }, doctor: { id: 'd1' } },
      ])

      const res = await todayModule.GET(makeTodayRequest())
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.stats.total).toBe(6)
      expect(body.stats.waiting).toBe(2)
      expect(body.stats.inProgress).toBe(1)
      expect(body.stats.upcoming).toBe(1)
      expect(body.stats.completed).toBe(1)
      expect(body.stats.noShow).toBe(1)
      expect(body.stats.avgWaitTime).toBe(15) // (10+20)/2
      expect(body.queue.waiting).toHaveLength(2)
      expect(body.queue.inProgress).toHaveLength(1)
    })

    it('filters by doctorId', async () => {
      ;(prisma.appointment.findMany as any).mockResolvedValue([])

      await todayModule.GET(makeTodayRequest({ doctorId: 'doc-1' }))
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ doctorId: 'doc-1' }),
        })
      )
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
        session: null,
      })

      const res = await todayModule.GET(makeTodayRequest())
      expect(res.status).toBe(401)
    })
  })

  // ─── GET /api/appointments/waitlist ───────────────
  describe('GET /api/appointments/waitlist', () => {
    it('returns enriched waitlist entries with summary', async () => {
      ;(prisma.waitlist.findMany as any).mockResolvedValue([
        { id: 'w1', patientId: 'p1', doctorId: 'd1', status: 'ACTIVE', createdAt: new Date() },
        { id: 'w2', patientId: 'p2', doctorId: null, status: 'ACTIVE', createdAt: new Date() },
      ])
      ;(prisma.waitlist.count as any)
        .mockResolvedValueOnce(2) // total
        .mockResolvedValueOnce(2) // active
        .mockResolvedValueOnce(0) // notified
        .mockResolvedValueOnce(0) // booked
      ;(prisma.patient.findMany as any).mockResolvedValue([
        { id: 'p1', firstName: 'John', lastName: 'Doe', phone: '9876543210', patientId: 'PAT001' },
        { id: 'p2', firstName: 'Jane', lastName: 'Smith', phone: '9876543211', patientId: 'PAT002' },
      ])
      ;(prisma.staff.findMany as any).mockResolvedValue([
        { id: 'd1', firstName: 'Dr', lastName: 'House' },
      ])

      const res = await waitlistModule.GET(makeWaitlistRequest('GET'))
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.entries).toHaveLength(2)
      expect(body.entries[0].patient.name).toBe('John Doe')
      expect(body.entries[0].doctor.name).toBe('Dr. Dr House')
      expect(body.entries[1].doctor).toBeNull()
      expect(body.summary.active).toBe(2)
    })

    it('filters by status and doctorId', async () => {
      ;(prisma.waitlist.findMany as any).mockResolvedValue([])
      ;(prisma.waitlist.count as any).mockResolvedValue(0)
      ;(prisma.patient.findMany as any).mockResolvedValue([])

      await waitlistModule.GET(makeWaitlistRequest('GET', { status: 'ACTIVE', doctorId: 'd1' }))
      expect(prisma.waitlist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
            doctorId: 'd1',
          }),
        })
      )
    })
  })

  // ─── POST /api/appointments/waitlist ──────────────
  describe('POST /api/appointments/waitlist', () => {
    it('adds patient to waitlist', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })
      ;(prisma.waitlist.findFirst as any).mockResolvedValue(null) // no existing entry
      ;(prisma.waitlist.create as any).mockResolvedValue({
        id: 'w1',
        patientId: 'p1',
        status: 'ACTIVE',
      })

      const res = await waitlistModule.POST(
        makeWaitlistRequest('POST', {}, {
          patientId: 'p1',
          preferredDays: 'Mon,Wed',
          preferredTime: 'morning',
          notes: 'Urgent',
        })
      )
      expect(res.status).toBe(201)
    })

    it('returns 400 when patientId missing', async () => {
      const res = await waitlistModule.POST(
        makeWaitlistRequest('POST', {}, {})
      )
      expect(res.status).toBe(400)
    })

    it('returns 404 when patient not found', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)

      const res = await waitlistModule.POST(
        makeWaitlistRequest('POST', {}, { patientId: 'p999' })
      )
      expect(res.status).toBe(404)
    })

    it('returns 409 when patient already on waitlist', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })
      ;(prisma.waitlist.findFirst as any).mockResolvedValue({ id: 'w-existing' })

      const res = await waitlistModule.POST(
        makeWaitlistRequest('POST', {}, { patientId: 'p1' })
      )
      expect(res.status).toBe(409)
    })

    it('returns 403 for non-permitted roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'ACCOUNTANT' } },
      })

      const res = await waitlistModule.POST(
        makeWaitlistRequest('POST', {}, { patientId: 'p1' })
      )
      expect(res.status).toBe(403)
    })
  })

  // ─── DELETE /api/appointments/waitlist ─────────────
  describe('DELETE /api/appointments/waitlist', () => {
    it('cancels a waitlist entry', async () => {
      ;(prisma.waitlist.findFirst as any).mockResolvedValue({ id: 'w1' })
      ;(prisma.waitlist.update as any).mockResolvedValue({ id: 'w1', status: 'CANCELLED' })

      const res = await waitlistModule.DELETE(makeWaitlistRequest('DELETE', { id: 'w1' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('Removed')
    })

    it('returns 400 when no id provided', async () => {
      const res = await waitlistModule.DELETE(makeWaitlistRequest('DELETE'))
      expect(res.status).toBe(400)
    })

    it('returns 404 when entry not found', async () => {
      ;(prisma.waitlist.findFirst as any).mockResolvedValue(null)

      const res = await waitlistModule.DELETE(makeWaitlistRequest('DELETE', { id: 'w999' }))
      expect(res.status).toBe(404)
    })
  })
})
