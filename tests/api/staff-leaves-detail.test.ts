// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  GET as leaveGET,
  PATCH as leavePATCH,
  DELETE as leaveDELETE,
} from '@/app/api/staff/leaves/[id]/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN', staffId: 'staff1' },
    hospitalId: 'h1',
    session: { user: { id: 'u1', name: 'Admin', role: 'ADMIN', staffId: 'staff1' } },
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

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/staff/leaves/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/staff/leaves/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await leaveGET(makeReq('/api/staff/leaves/lv1'), makeParams('lv1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when leave not found', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findFirst).mockResolvedValue(null)
    const res = await leaveGET(makeReq('/api/staff/leaves/lv1'), makeParams('lv1') as any)
    expect(res.status).toBe(404)
  })

  it('returns leave with staff details', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findFirst).mockResolvedValue({
      id: 'lv1', leaveType: 'SICK', status: 'PENDING',
      startDate: new Date('2026-03-01'), endDate: new Date('2026-03-02'),
      staff: {
        id: 'staff1', employeeId: 'EMP001',
        firstName: 'Jane', lastName: 'Doe',
        user: { role: 'DOCTOR' },
      },
    } as any)

    const res = await leaveGET(makeReq('/api/staff/leaves/lv1'), makeParams('lv1') as any)
    const body = await res.json()

    expect(body.id).toBe('lv1')
    expect(body.staff.firstName).toBe('Jane')
  })

  it('scopes query to hospital via staff relation', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findFirst).mockResolvedValue(null)
    await leaveGET(makeReq('/api/staff/leaves/lv1'), makeParams('lv1') as any)

    const call = vi.mocked(prisma.leave.findFirst).mock.calls[0][0]
    expect(call.where.staff.hospitalId).toBe('h1')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. PATCH /api/staff/leaves/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PATCH /api/staff/leaves/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await leavePATCH(
      makeReq('/api/staff/leaves/lv1', 'PATCH', { status: 'APPROVED' }),
      makeParams('lv1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 when leave not found', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findFirst).mockResolvedValue(null)
    const res = await leavePATCH(
      makeReq('/api/staff/leaves/lv1', 'PATCH', { status: 'APPROVED' }),
      makeParams('lv1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('returns 403 when non-admin tries to approve', async () => {
    mockAuth({
      session: { user: { id: 'u1', role: 'DOCTOR', staffId: 'staff1' } },
    })
    vi.mocked(prisma.leave.findFirst).mockResolvedValue({
      id: 'lv1', staffId: 'staff2', status: 'PENDING',
      startDate: new Date('2026-03-01'), endDate: new Date('2026-03-01'),
    } as any)

    const res = await leavePATCH(
      makeReq('/api/staff/leaves/lv1', 'PATCH', { status: 'APPROVED' }),
      makeParams('lv1') as any,
    )
    expect(res.status).toBe(403)
  })

  it('returns 403 when non-admin tries to reject', async () => {
    mockAuth({
      session: { user: { id: 'u1', role: 'STAFF', staffId: 'staff1' } },
    })
    vi.mocked(prisma.leave.findFirst).mockResolvedValue({
      id: 'lv1', staffId: 'staff2', status: 'PENDING',
      startDate: new Date('2026-03-01'), endDate: new Date('2026-03-01'),
    } as any)

    const res = await leavePATCH(
      makeReq('/api/staff/leaves/lv1', 'PATCH', { status: 'REJECTED' }),
      makeParams('lv1') as any,
    )
    expect(res.status).toBe(403)
  })

  it('approves leave and creates attendance records', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findFirst).mockResolvedValue({
      id: 'lv1', staffId: 'staff2', status: 'PENDING',
      leaveType: 'SICK',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-02'),
    } as any)
    vi.mocked(prisma.leave.update).mockResolvedValue({
      id: 'lv1', status: 'APPROVED',
      staff: { employeeId: 'EMP002', firstName: 'Jane', lastName: 'Doe' },
    } as any)
    vi.mocked(prisma.attendance.upsert).mockResolvedValue({} as any)

    const res = await leavePATCH(
      makeReq('/api/staff/leaves/lv1', 'PATCH', { status: 'APPROVED' }),
      makeParams('lv1') as any,
    )
    const body = await res.json()

    expect(body.status).toBe('APPROVED')
    // Should create attendance for 2 days (March 1 + March 2)
    expect(prisma.attendance.upsert).toHaveBeenCalledTimes(2)
  })

  it('sets approvedBy when admin approves', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findFirst).mockResolvedValue({
      id: 'lv1', staffId: 'staff2', status: 'PENDING',
      leaveType: 'CASUAL',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-01'),
    } as any)
    vi.mocked(prisma.leave.update).mockResolvedValue({ id: 'lv1', status: 'APPROVED' } as any)
    vi.mocked(prisma.attendance.upsert).mockResolvedValue({} as any)

    await leavePATCH(
      makeReq('/api/staff/leaves/lv1', 'PATCH', { status: 'APPROVED' }),
      makeParams('lv1') as any,
    )

    const updateCall = vi.mocked(prisma.leave.update).mock.calls[0][0]
    expect(updateCall.data.approvedBy).toBe('staff1')
  })

  it('rejects leave without creating attendance records', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findFirst).mockResolvedValue({
      id: 'lv1', staffId: 'staff2', status: 'PENDING',
      startDate: new Date('2026-03-01'), endDate: new Date('2026-03-02'),
    } as any)
    vi.mocked(prisma.leave.update).mockResolvedValue({
      id: 'lv1', status: 'REJECTED',
      staff: { employeeId: 'EMP002', firstName: 'Jane', lastName: 'Doe' },
    } as any)

    await leavePATCH(
      makeReq('/api/staff/leaves/lv1', 'PATCH', { status: 'REJECTED' }),
      makeParams('lv1') as any,
    )

    expect(prisma.attendance.upsert).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. DELETE /api/staff/leaves/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/staff/leaves/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await leaveDELETE(makeReq('/api/staff/leaves/lv1', 'DELETE'), makeParams('lv1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when leave not found', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findFirst).mockResolvedValue(null)
    const res = await leaveDELETE(makeReq('/api/staff/leaves/lv1', 'DELETE'), makeParams('lv1') as any)
    expect(res.status).toBe(404)
  })

  it('returns 400 when trying to delete non-pending leave', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findFirst).mockResolvedValue({
      id: 'lv1', status: 'APPROVED',
    } as any)

    const res = await leaveDELETE(makeReq('/api/staff/leaves/lv1', 'DELETE'), makeParams('lv1') as any)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('pending')
  })

  it('deletes pending leave request', async () => {
    mockAuth()
    vi.mocked(prisma.leave.findFirst).mockResolvedValue({
      id: 'lv1', status: 'PENDING',
    } as any)
    vi.mocked(prisma.leave.delete).mockResolvedValue({ id: 'lv1' } as any)

    const res = await leaveDELETE(makeReq('/api/staff/leaves/lv1', 'DELETE'), makeParams('lv1') as any)
    const body = await res.json()

    expect(body.message).toContain('deleted')
    expect(prisma.leave.delete).toHaveBeenCalledWith({ where: { id: 'lv1' } })
  })
})
