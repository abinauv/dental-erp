import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const perfModule = await import('@/app/api/staff/[id]/performance/route')
const todayModule = await import('@/app/api/staff/attendance/today/route')

function makePerfRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/staff/staff-1/performance')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString()) as any
}

const perfCtx = { params: Promise.resolve({ id: 'staff-1' }) }

describe('Staff Performance & Attendance API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  // ─── GET /api/staff/[id]/performance ──────────────────
  describe('GET /api/staff/[id]/performance', () => {
    it('returns comprehensive performance stats', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue({
        id: 'staff-1',
        employeeId: 'EMP001',
        firstName: 'Jane',
        lastName: 'Smith',
        specialization: 'Orthodontics',
        user: { role: 'DOCTOR' },
      })

      ;(prisma.appointment.findMany as any).mockResolvedValue([
        { id: 'a1', status: 'COMPLETED', waitTime: 10, scheduledDate: new Date() },
        { id: 'a2', status: 'COMPLETED', waitTime: 20, scheduledDate: new Date() },
        { id: 'a3', status: 'CANCELLED', waitTime: null, scheduledDate: new Date() },
        { id: 'a4', status: 'NO_SHOW', waitTime: null, scheduledDate: new Date() },
      ])

      ;(prisma.treatment.findMany as any).mockResolvedValue([
        { id: 't1', status: 'COMPLETED', cost: 3000, procedure: { category: 'RESTORATIVE', name: 'Filling' } },
        { id: 't2', status: 'COMPLETED', cost: 5000, procedure: { category: 'ORTHODONTIC', name: 'Braces' } },
        { id: 't3', status: 'IN_PROGRESS', cost: 2000, procedure: { category: 'RESTORATIVE', name: 'Crown' } },
      ])

      ;(prisma.treatment.groupBy as any).mockResolvedValue([
        { patientId: 'p1' },
        { patientId: 'p2' },
      ])

      ;(prisma.attendance.findMany as any).mockResolvedValue([
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'LATE' },
        { status: 'ABSENT' },
      ])

      ;(prisma.prescription.count as any).mockResolvedValue(5)

      const res = await perfModule.GET(makePerfRequest(), perfCtx)
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.staff.name).toBe('Jane Smith')
      expect(body.staff.role).toBe('DOCTOR')
      expect(body.appointments.total).toBe(4)
      expect(body.appointments.completed).toBe(2)
      expect(body.appointments.noShow).toBe(1)
      expect(body.appointments.avgWaitTime).toBe(15) // (10+20)/2
      expect(body.treatments.total).toBe(3)
      expect(body.treatments.completed).toBe(2)
      expect(body.revenue.total).toBe(8000) // 3000+5000
      expect(body.revenue.averagePerTreatment).toBe(4000)
      expect(body.patientsTreated).toBe(2)
      expect(body.prescriptionsWritten).toBe(5)
      expect(body.attendance.present).toBe(2)
      expect(body.attendance.late).toBe(1)
      expect(body.attendance.absent).toBe(1)
      expect(body.procedureBreakdown).toHaveLength(2) // RESTORATIVE + ORTHODONTIC
    })

    it('returns 404 when staff not found', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue(null)

      const res = await perfModule.GET(makePerfRequest(), perfCtx)
      expect(res.status).toBe(404)
    })

    it('uses custom date range when provided', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue({
        id: 'staff-1',
        employeeId: 'EMP001',
        firstName: 'Jane',
        lastName: 'Smith',
        specialization: null,
        user: { role: 'DOCTOR' },
      })
      ;(prisma.appointment.findMany as any).mockResolvedValue([])
      ;(prisma.treatment.findMany as any).mockResolvedValue([])
      ;(prisma.treatment.groupBy as any).mockResolvedValue([])
      ;(prisma.attendance.findMany as any).mockResolvedValue([])
      ;(prisma.prescription.count as any).mockResolvedValue(0)

      const res = await perfModule.GET(
        makePerfRequest({ startDate: '2025-01-01', endDate: '2025-06-30' }),
        perfCtx
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.period.start).toBe('2025-01-01')
      expect(body.period.end).toBe('2025-06-30')
    })

    it('handles zero completed treatments for averages', async () => {
      ;(prisma.staff.findFirst as any).mockResolvedValue({
        id: 'staff-1',
        employeeId: 'EMP001',
        firstName: 'Jane',
        lastName: 'Smith',
        specialization: null,
        user: { role: 'DOCTOR' },
      })
      ;(prisma.appointment.findMany as any).mockResolvedValue([])
      ;(prisma.treatment.findMany as any).mockResolvedValue([
        { id: 't1', status: 'IN_PROGRESS', cost: 1000, procedure: { category: 'RESTORATIVE', name: 'Filling' } },
      ])
      ;(prisma.treatment.groupBy as any).mockResolvedValue([])
      ;(prisma.attendance.findMany as any).mockResolvedValue([])
      ;(prisma.prescription.count as any).mockResolvedValue(0)

      const res = await perfModule.GET(makePerfRequest(), perfCtx)
      const body = await res.json()
      expect(body.revenue.total).toBe(0)
      expect(body.revenue.averagePerTreatment).toBe(0)
      expect(body.procedureBreakdown).toHaveLength(0)
    })
  })

  // ─── GET /api/staff/attendance/today ──────────────────
  describe('GET /api/staff/attendance/today', () => {
    it('returns today attendance summary and staff list', async () => {
      ;(prisma.staff.findMany as any).mockResolvedValue([
        {
          id: 's1',
          firstName: 'Jane',
          lastName: 'Smith',
          user: { role: 'DOCTOR' },
          attendance: [{ status: 'PRESENT', clockIn: '09:00', clockOut: null, notes: null }],
        },
        {
          id: 's2',
          firstName: 'Bob',
          lastName: 'Jones',
          user: { role: 'RECEPTIONIST' },
          attendance: [{ status: 'LATE', clockIn: '09:30', clockOut: null, notes: 'Traffic' }],
        },
        {
          id: 's3',
          firstName: 'Alice',
          lastName: 'Brown',
          user: { role: 'DOCTOR' },
          attendance: [], // not marked
        },
      ])

      const req = new Request('http://localhost/api/staff/attendance/today') as any
      const res = await todayModule.GET(req)
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.date).toBeDefined()
      expect(body.summary.total).toBe(3)
      expect(body.summary.present).toBe(1)
      expect(body.summary.late).toBe(1)
      expect(body.summary.notMarked).toBe(1)
      expect(body.staff).toHaveLength(3)
      expect(body.staff[2].todayStatus).toBeNull() // Alice not marked
    })

    it('handles all attendance statuses', async () => {
      ;(prisma.staff.findMany as any).mockResolvedValue([
        { id: 's1', firstName: 'A', lastName: 'B', user: { role: 'DOCTOR' }, attendance: [{ status: 'PRESENT', clockIn: '09:00', clockOut: '17:00', notes: null }] },
        { id: 's2', firstName: 'C', lastName: 'D', user: { role: 'DOCTOR' }, attendance: [{ status: 'ABSENT', clockIn: null, clockOut: null, notes: null }] },
        { id: 's3', firstName: 'E', lastName: 'F', user: { role: 'DOCTOR' }, attendance: [{ status: 'HALF_DAY', clockIn: '09:00', clockOut: '13:00', notes: null }] },
        { id: 's4', firstName: 'G', lastName: 'H', user: { role: 'DOCTOR' }, attendance: [{ status: 'ON_LEAVE', clockIn: null, clockOut: null, notes: null }] },
      ])

      const req = new Request('http://localhost/api/staff/attendance/today') as any
      const res = await todayModule.GET(req)
      const body = await res.json()

      expect(body.summary.present).toBe(1)
      expect(body.summary.absent).toBe(1)
      expect(body.summary.halfDay).toBe(1)
      expect(body.summary.onLeave).toBe(1)
      expect(body.summary.notMarked).toBe(0)
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
        session: null,
      })

      const req = new Request('http://localhost/api/staff/attendance/today') as any
      const res = await todayModule.GET(req)
      expect(res.status).toBe(401)
    })
  })
})
