// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as doctorsGET } from '@/app/api/staff/doctors/route'
import { GET as attendanceGET, POST as attendancePOST } from '@/app/api/staff/attendance/route'
import { GET as leavesGET, POST as leavesPOST } from '@/app/api/staff/leaves/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Auth helpers ─────────────────────────────────────────────────────────────

function mockAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
    session: { user: { id: 'u1', name: 'Admin', role: 'ADMIN' } },
    hospitalId: 'h1',
  }
  vi.mocked(requireAuthAndRole).mockResolvedValue({ ...defaults, ...overrides } as any)
}

function mockAuthError() {
  vi.mocked(requireAuthAndRole).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  } as any)
}

function makeReq(path: string, method = 'GET', body?: any): NextRequest {
  const url = `http://localhost${path}`
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init)
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/staff/doctors
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/staff/doctors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await doctorsGET(makeReq('/api/staff/doctors'))
    expect(res.status).toBe(401)
  })

  it('returns list of active doctors', async () => {
    mockAuth()
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 's1', employeeId: 'EMP001', firstName: 'Dr', lastName: 'Smith', specialization: 'Orthodontics', phone: '9876543210', email: 'smith@clinic.com' },
      { id: 's2', employeeId: 'EMP002', firstName: 'Dr', lastName: 'Jones', specialization: 'Endodontics', phone: '9876543211', email: 'jones@clinic.com' },
    ] as any)

    const res = await doctorsGET(makeReq('/api/staff/doctors'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.doctors).toHaveLength(2)
    expect(body.doctors[0].firstName).toBe('Dr')

    // Verify it filters by DOCTOR role
    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hospitalId: 'h1',
          isActive: true,
          user: { role: 'DOCTOR', isActive: true },
        }),
      })
    )
  })

  it('returns empty list when no doctors', async () => {
    mockAuth()
    vi.mocked(prisma.staff.findMany).mockResolvedValue([])

    const res = await doctorsGET(makeReq('/api/staff/doctors'))
    const body = await res.json()

    expect(body.doctors).toHaveLength(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET/POST /api/staff/attendance
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/staff/attendance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await attendanceGET(makeReq('/api/staff/attendance'))
    expect(res.status).toBe(401)
  })

  it('returns attendance records with pagination', async () => {
    mockAuth()
    const mockRecords = [
      { id: 'a1', staffId: 's1', date: new Date('2026-02-20'), status: 'PRESENT', clockIn: new Date(), staff: { id: 's1', employeeId: 'E001', firstName: 'John', lastName: 'Doe', user: { role: 'DOCTOR' } } },
    ]
    vi.mocked(prisma.attendance.findMany).mockResolvedValue(mockRecords as any)
    vi.mocked(prisma.attendance.count).mockResolvedValue(1)

    const res = await attendanceGET(makeReq('/api/staff/attendance'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.attendance).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('filters by staffId', async () => {
    mockAuth()
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([])
    vi.mocked(prisma.attendance.count).mockResolvedValue(0)

    await attendanceGET(makeReq('/api/staff/attendance?staffId=s1'))

    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ staffId: 's1' }),
      })
    )
  })

  it('filters by date range', async () => {
    mockAuth()
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([])
    vi.mocked(prisma.attendance.count).mockResolvedValue(0)

    await attendanceGET(makeReq('/api/staff/attendance?startDate=2026-02-01&endDate=2026-02-28'))

    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date('2026-02-01'),
            lte: new Date('2026-02-28'),
          },
        }),
      })
    )
  })
})

describe('POST /api/staff/attendance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await attendancePOST(makeReq('/api/staff/attendance', 'POST', { staffId: 's1' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('staffId')
  })

  it('returns 404 when staff not found', async () => {
    mockAuth()
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null)

    const res = await attendancePOST(makeReq('/api/staff/attendance', 'POST', {
      staffId: 's-nonexistent',
      date: '2026-02-20',
      status: 'PRESENT',
    }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Staff not found')
  })

  it('creates new attendance record', async () => {
    mockAuth()
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 's1' } as any)
    vi.mocked(prisma.attendance.findUnique).mockResolvedValue(null) // no existing
    vi.mocked(prisma.attendance.create).mockResolvedValue({
      id: 'att1', staffId: 's1', status: 'PRESENT', date: new Date('2026-02-20'),
      staff: { employeeId: 'E001', firstName: 'John', lastName: 'Doe' },
    } as any)

    const res = await attendancePOST(makeReq('/api/staff/attendance', 'POST', {
      staffId: 's1',
      date: '2026-02-20',
      status: 'PRESENT',
      clockIn: '2026-02-20T09:00:00',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.staffId).toBe('s1')
  })

  it('updates existing attendance record', async () => {
    mockAuth()
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 's1' } as any)
    vi.mocked(prisma.attendance.findUnique).mockResolvedValue({ id: 'att1', clockIn: new Date(), clockOut: null } as any)
    vi.mocked(prisma.attendance.update).mockResolvedValue({
      id: 'att1', staffId: 's1', status: 'PRESENT',
      staff: { employeeId: 'E001', firstName: 'John', lastName: 'Doe' },
    } as any)

    const res = await attendancePOST(makeReq('/api/staff/attendance', 'POST', {
      staffId: 's1',
      date: '2026-02-20',
      status: 'PRESENT',
      clockOut: '2026-02-20T18:00:00',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.attendance.update).toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET/POST /api/staff/leaves
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/staff/leaves', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await leavesGET(makeReq('/api/staff/leaves'))
    expect(res.status).toBe(401)
  })

  it('returns leave requests with pagination', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findMany).mockResolvedValue([
      { id: 'l1', staffId: 's1', leaveType: 'CASUAL', status: 'PENDING', startDate: new Date(), endDate: new Date(), staff: { id: 's1', employeeId: 'E001', firstName: 'John', lastName: 'Doe', user: { role: 'DOCTOR' } } },
    ] as any)
    vi.mocked(prisma.leave.count).mockResolvedValue(1)

    const res = await leavesGET(makeReq('/api/staff/leaves'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.leaves).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('filters by status and staffId', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findMany).mockResolvedValue([])
    vi.mocked(prisma.leave.count).mockResolvedValue(0)

    await leavesGET(makeReq('/api/staff/leaves?staffId=s1&status=APPROVED'))

    expect(prisma.leave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          staffId: 's1',
          status: 'APPROVED',
        }),
      })
    )
  })
})

describe('POST /api/staff/leaves', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await leavesPOST(makeReq('/api/staff/leaves', 'POST', { staffId: 's1' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('leaveType')
  })

  it('returns 404 when staff not found', async () => {
    mockAuth()
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null)

    const res = await leavesPOST(makeReq('/api/staff/leaves', 'POST', {
      staffId: 's-nonexistent',
      leaveType: 'CASUAL',
      startDate: '2026-03-01',
      endDate: '2026-03-03',
    }))

    expect(res.status).toBe(404)
  })

  it('returns 400 when end date before start date', async () => {
    mockAuth()
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 's1' } as any)

    const res = await leavesPOST(makeReq('/api/staff/leaves', 'POST', {
      staffId: 's1',
      leaveType: 'CASUAL',
      startDate: '2026-03-05',
      endDate: '2026-03-01',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('End date')
  })

  it('returns 400 for overlapping leave request', async () => {
    mockAuth()
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 's1' } as any)
    vi.mocked(prisma.leave.findFirst).mockResolvedValue({ id: 'l1' } as any)

    const res = await leavesPOST(makeReq('/api/staff/leaves', 'POST', {
      staffId: 's1',
      leaveType: 'CASUAL',
      startDate: '2026-03-01',
      endDate: '2026-03-03',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('already a leave request')
  })

  it('creates leave request successfully', async () => {
    mockAuth()
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 's1' } as any)
    vi.mocked(prisma.leave.findFirst).mockResolvedValue(null) // no overlap
    vi.mocked(prisma.leave.create).mockResolvedValue({
      id: 'l1', staffId: 's1', leaveType: 'CASUAL', status: 'PENDING',
      startDate: new Date('2026-03-01'), endDate: new Date('2026-03-03'),
      staff: { employeeId: 'E001', firstName: 'John', lastName: 'Doe' },
    } as any)

    const res = await leavesPOST(makeReq('/api/staff/leaves', 'POST', {
      staffId: 's1',
      leaveType: 'CASUAL',
      startDate: '2026-03-01',
      endDate: '2026-03-03',
      reason: 'Personal',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.leaveType).toBe('CASUAL')
    expect(body.status).toBe('PENDING')
  })
})
