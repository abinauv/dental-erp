import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

// Mock auth
const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))
vi.mock('@/lib/api-helpers', () => mockAuth)

// Mock prisma
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

function makeRequest(url: string, options: any = {}) {
  return new Request(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
}

describe('POST /api/appointments/[id]/check-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'RECEPTIONIST' } },
    })
  })

  it('checks in a SCHEDULED appointment', async () => {
    const { POST } = await import('@/app/api/appointments/[id]/check-in/route')

    const appt = {
      id: 'a1',
      hospitalId: 'h1',
      status: 'SCHEDULED',
      scheduledDate: new Date(),
      scheduledTime: '10:00',
    }
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(appt as any)
    vi.mocked(prisma.appointment.update).mockResolvedValue({
      ...appt,
      status: 'CHECKED_IN',
      patient: { id: 'p1', firstName: 'John', lastName: 'Doe' },
      doctor: { id: 'd1', firstName: 'Dr', lastName: 'Smith' },
    } as any)

    const req = makeRequest('http://localhost/api/appointments/a1/check-in', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'a1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe('CHECKED_IN')
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1' },
        data: expect.objectContaining({ status: 'CHECKED_IN' }),
      })
    )
  })

  it('checks in a CONFIRMED appointment', async () => {
    const { POST } = await import('@/app/api/appointments/[id]/check-in/route')

    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: 'a2',
      hospitalId: 'h1',
      status: 'CONFIRMED',
      scheduledDate: new Date(),
      scheduledTime: '14:00',
    } as any)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ status: 'CHECKED_IN' } as any)

    const req = makeRequest('http://localhost/api/appointments/a2/check-in', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'a2' }) })

    expect(res.status).toBe(200)
  })

  it('rejects check-in for COMPLETED appointment', async () => {
    const { POST } = await import('@/app/api/appointments/[id]/check-in/route')

    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: 'a3',
      hospitalId: 'h1',
      status: 'COMPLETED',
      scheduledDate: new Date(),
      scheduledTime: '09:00',
    } as any)

    const req = makeRequest('http://localhost/api/appointments/a3/check-in', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'a3' }) })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Cannot check in')
  })

  it('returns 404 for non-existent appointment', async () => {
    const { POST } = await import('@/app/api/appointments/[id]/check-in/route')

    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/appointments/x/check-in', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'x' }) })

    expect(res.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('@/app/api/appointments/[id]/check-in/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      hospitalId: null,
    })

    const req = makeRequest('http://localhost/api/appointments/a1/check-in', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'a1' }) })

    expect(res.status).toBe(401)
  })
})

describe('POST /api/appointments/[id]/check-out', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'RECEPTIONIST' } },
    })
  })

  it('checks out a CHECKED_IN appointment', async () => {
    const { POST } = await import('@/app/api/appointments/[id]/check-out/route')

    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: 'a1',
      hospitalId: 'h1',
      status: 'CHECKED_IN',
      notes: null,
    } as any)
    vi.mocked(prisma.appointment.update).mockResolvedValue({
      status: 'COMPLETED',
      patient: { id: 'p1' },
      doctor: { id: 'd1' },
    } as any)

    const req = makeRequest('http://localhost/api/appointments/a1/check-out', {
      method: 'POST',
      body: { notes: 'All good' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'a1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe('COMPLETED')
  })

  it('checks out an IN_PROGRESS appointment', async () => {
    const { POST } = await import('@/app/api/appointments/[id]/check-out/route')

    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: 'a2',
      hospitalId: 'h1',
      status: 'IN_PROGRESS',
      notes: 'Existing notes',
    } as any)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ status: 'COMPLETED' } as any)

    const req = makeRequest('http://localhost/api/appointments/a2/check-out', {
      method: 'POST',
      body: {},
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'a2' }) })

    expect(res.status).toBe(200)
  })

  it('rejects check-out for SCHEDULED appointment', async () => {
    const { POST } = await import('@/app/api/appointments/[id]/check-out/route')

    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: 'a3',
      hospitalId: 'h1',
      status: 'SCHEDULED',
    } as any)

    const req = makeRequest('http://localhost/api/appointments/a3/check-out', {
      method: 'POST',
      body: {},
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'a3' }) })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Cannot check out')
  })

  it('returns 404 for missing appointment', async () => {
    const { POST } = await import('@/app/api/appointments/[id]/check-out/route')

    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/appointments/x/check-out', {
      method: 'POST',
      body: {},
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'x' }) })

    expect(res.status).toBe(404)
  })
})

describe('GET /api/appointments/today', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'RECEPTIONIST' } },
    })
  })

  it('returns today appointments grouped by status', async () => {
    const { GET } = await import('@/app/api/appointments/today/route')

    const appts = [
      { id: 'a1', status: 'CHECKED_IN', waitTime: 10, patient: {}, doctor: {} },
      { id: 'a2', status: 'SCHEDULED', waitTime: 0, patient: {}, doctor: {} },
      { id: 'a3', status: 'COMPLETED', waitTime: 0, patient: {}, doctor: {} },
    ]
    vi.mocked(prisma.appointment.findMany).mockResolvedValue(appts as any)

    const req = makeRequest('http://localhost/api/appointments/today')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.appointments).toHaveLength(3)
    expect(data.queue.waiting).toHaveLength(1)
    expect(data.queue.upcoming).toHaveLength(1)
    expect(data.queue.completed).toHaveLength(1)
    expect(data.stats.total).toBe(3)
    expect(data.stats.avgWaitTime).toBe(10)
  })

  it('filters by doctorId', async () => {
    const { GET } = await import('@/app/api/appointments/today/route')

    vi.mocked(prisma.appointment.findMany).mockResolvedValue([] as any)

    const req = makeRequest('http://localhost/api/appointments/today?doctorId=d1')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ doctorId: 'd1' }),
      })
    )
  })

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await import('@/app/api/appointments/today/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      hospitalId: null,
    })

    const req = makeRequest('http://localhost/api/appointments/today')
    const res = await GET(req)

    expect(res.status).toBe(401)
  })
})

describe('GET /api/appointments/slots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'RECEPTIONIST' } },
    })
  })

  it('returns available slots for a doctor on a date', async () => {
    const { GET } = await import('@/app/api/appointments/slots/route')

    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      workingHours: JSON.stringify({ start: '09:00', end: '10:00', lunchStart: '13:00', lunchEnd: '14:00' }),
    } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.staffShift.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])

    const req = makeRequest('http://localhost/api/appointments/slots?doctorId=d1&date=2026-03-15')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.available).toBe(true)
    expect(data.slots).toBeDefined()
    expect(data.slots.length).toBeGreaterThan(0)
  })

  it('returns empty slots on holiday', async () => {
    const { GET } = await import('@/app/api/appointments/slots/route')

    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({ workingHours: null } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue({ name: 'Diwali' } as any)

    const req = makeRequest('http://localhost/api/appointments/slots?doctorId=d1&date=2026-03-15')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.available).toBe(false)
    expect(data.reason).toContain('Holiday')
    expect(data.slots).toHaveLength(0)
  })

  it('returns 400 if doctorId or date missing', async () => {
    const { GET } = await import('@/app/api/appointments/slots/route')

    const req = makeRequest('http://localhost/api/appointments/slots')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('required')
  })

  it('returns 404 if doctor not found', async () => {
    const { GET } = await import('@/app/api/appointments/slots/route')

    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({ workingHours: null } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/appointments/slots?doctorId=bad&date=2026-03-15')
    const res = await GET(req)

    expect(res.status).toBe(404)
  })

  it('marks booked slots as unavailable', async () => {
    const { GET } = await import('@/app/api/appointments/slots/route')

    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      workingHours: JSON.stringify({ start: '09:00', end: '10:00', lunchStart: '13:00', lunchEnd: '14:00' }),
    } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.staffShift.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { scheduledTime: '09:00', duration: 30 },
    ] as any)

    const req = makeRequest('http://localhost/api/appointments/slots?doctorId=d1&date=2026-03-15')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    const bookedSlot = data.slots.find((s: any) => s.time === '09:00')
    expect(bookedSlot.available).toBe(false)
  })
})

describe('GET/POST/DELETE /api/appointments/waitlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'RECEPTIONIST' } },
    })
  })

  it('GET returns waitlist with enriched data and summary', async () => {
    const { GET } = await import('@/app/api/appointments/waitlist/route')

    vi.mocked(prisma.waitlist.findMany).mockResolvedValue([
      { id: 'w1', patientId: 'p1', doctorId: 'd1', status: 'ACTIVE', createdAt: new Date() },
    ] as any)
    vi.mocked(prisma.waitlist.count)
      .mockResolvedValueOnce(1)  // total
      .mockResolvedValueOnce(5)  // active
      .mockResolvedValueOnce(2)  // notified
      .mockResolvedValueOnce(3)  // booked
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: 'p1', firstName: 'Jane', lastName: 'Doe', phone: '1234', patientId: 'PID1' },
    ] as any)
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 'd1', firstName: 'Dr', lastName: 'Smith' },
    ] as any)

    const req = makeRequest('http://localhost/api/appointments/waitlist')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0].patient.name).toBe('Jane Doe')
    expect(data.entries[0].doctor.name).toBe('Dr. Dr Smith')
    expect(data.summary.active).toBe(5)
    expect(data.summary.notified).toBe(2)
    expect(data.summary.booked).toBe(3)
  })

  it('POST adds patient to waitlist', async () => {
    const { POST } = await import('@/app/api/appointments/waitlist/route')

    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.waitlist.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.waitlist.create).mockResolvedValue({
      id: 'w1',
      patientId: 'p1',
      status: 'ACTIVE',
    } as any)

    const req = makeRequest('http://localhost/api/appointments/waitlist', {
      method: 'POST',
      body: { patientId: 'p1', doctorId: 'd1', notes: 'Urgent' },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.patientId).toBe('p1')
  })

  it('POST rejects duplicate active entry (409)', async () => {
    const { POST } = await import('@/app/api/appointments/waitlist/route')

    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.waitlist.findFirst).mockResolvedValue({ id: 'existing' } as any)

    const req = makeRequest('http://localhost/api/appointments/waitlist', {
      method: 'POST',
      body: { patientId: 'p1' },
    })
    const res = await POST(req)

    expect(res.status).toBe(409)
  })

  it('POST returns 400 if patientId missing', async () => {
    const { POST } = await import('@/app/api/appointments/waitlist/route')

    const req = makeRequest('http://localhost/api/appointments/waitlist', {
      method: 'POST',
      body: {},
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('POST returns 404 if patient not found', async () => {
    const { POST } = await import('@/app/api/appointments/waitlist/route')

    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/appointments/waitlist', {
      method: 'POST',
      body: { patientId: 'bad' },
    })
    const res = await POST(req)

    expect(res.status).toBe(404)
  })

  it('POST returns 403 for unauthorized role', async () => {
    const { POST } = await import('@/app/api/appointments/waitlist/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'STAFF' } },
    })

    const req = makeRequest('http://localhost/api/appointments/waitlist', {
      method: 'POST',
      body: { patientId: 'p1' },
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
  })

  it('DELETE cancels a waitlist entry', async () => {
    const { DELETE } = await import('@/app/api/appointments/waitlist/route')

    vi.mocked(prisma.waitlist.findFirst).mockResolvedValue({ id: 'w1', hospitalId: 'h1' } as any)
    vi.mocked(prisma.waitlist.update).mockResolvedValue({ status: 'CANCELLED' } as any)

    const req = makeRequest('http://localhost/api/appointments/waitlist?id=w1', { method: 'DELETE' })
    const res = await DELETE(req)

    expect(res.status).toBe(200)
    expect(prisma.waitlist.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w1' },
        data: { status: 'CANCELLED' },
      })
    )
  })

  it('DELETE returns 400 if id missing', async () => {
    const { DELETE } = await import('@/app/api/appointments/waitlist/route')

    const req = makeRequest('http://localhost/api/appointments/waitlist', { method: 'DELETE' })
    const res = await DELETE(req)

    expect(res.status).toBe(400)
  })

  it('DELETE returns 404 if entry not found', async () => {
    const { DELETE } = await import('@/app/api/appointments/waitlist/route')

    vi.mocked(prisma.waitlist.findFirst).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/appointments/waitlist?id=bad', { method: 'DELETE' })
    const res = await DELETE(req)

    expect(res.status).toBe(404)
  })
})
