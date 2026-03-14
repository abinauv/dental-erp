// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/services/video.service', () => ({
  createRoom: vi.fn(() => ({ roomUrl: 'https://video.example.com/room-abc', roomName: 'room-abc' })),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as consultationsGET, POST as consultationsPOST } from '@/app/api/video/consultations/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockAuth(overrides = {}) {
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

function makeReq(path: string, method = 'GET', body?: any): Request {
  const url = `http://localhost${path}`
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new Request(url, init)
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/video/consultations
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/video/consultations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await consultationsGET(makeReq('/api/video/consultations'))
    expect(res.status).toBe(401)
  })

  it('returns consultations with pagination and summary', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findMany).mockResolvedValue([
      { id: 'vc1', status: 'SCHEDULED', patient: { firstName: 'John' }, doctor: { firstName: 'Dr' } },
    ] as any)
    vi.mocked(prisma.videoConsultation.count)
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(5) // scheduled
      .mockResolvedValueOnce(1) // inProgress
      .mockResolvedValueOnce(10) // completed
      .mockResolvedValueOnce(2) // cancelled

    const res = await consultationsGET(makeReq('/api/video/consultations'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.consultations).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.summary.scheduled).toBe(5)
    expect(body.summary.inProgress).toBe(1)
    expect(body.summary.completed).toBe(10)
    expect(body.summary.cancelled).toBe(2)
  })

  it('filters by status, doctorId, patientId', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findMany).mockResolvedValue([])
    vi.mocked(prisma.videoConsultation.count).mockResolvedValue(0)

    await consultationsGET(makeReq('/api/video/consultations?status=SCHEDULED&doctorId=d1&patientId=p1'))

    expect(prisma.videoConsultation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'SCHEDULED',
          doctorId: 'd1',
          patientId: 'p1',
        }),
      })
    )
  })

  it('filters by date range', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findMany).mockResolvedValue([])
    vi.mocked(prisma.videoConsultation.count).mockResolvedValue(0)

    await consultationsGET(makeReq('/api/video/consultations?from=2026-01-01&to=2026-02-28'))

    expect(prisma.videoConsultation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduledAt: expect.objectContaining({
            gte: new Date('2026-01-01'),
            lte: new Date('2026-02-28'),
          }),
        }),
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/video/consultations
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/video/consultations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await consultationsPOST(makeReq('/api/video/consultations', 'POST', {}))
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await consultationsPOST(makeReq('/api/video/consultations', 'POST', { patientId: 'p1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('required')
  })

  it('returns 404 when patient not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)

    const res = await consultationsPOST(makeReq('/api/video/consultations', 'POST', {
      patientId: 'p-none', doctorId: 'd1', scheduledAt: '2026-03-01T10:00:00Z',
    }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('Patient')
  })

  it('returns 404 when doctor not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null)

    const res = await consultationsPOST(makeReq('/api/video/consultations', 'POST', {
      patientId: 'p1', doctorId: 'd-none', scheduledAt: '2026-03-01T10:00:00Z',
    }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('Doctor')
  })

  it('returns 404 when linked appointment not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)

    const res = await consultationsPOST(makeReq('/api/video/consultations', 'POST', {
      patientId: 'p1', doctorId: 'd1', scheduledAt: '2026-03-01T10:00:00Z',
      appointmentId: 'a-none',
    }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('Appointment')
  })

  it('returns 409 when consultation already exists for appointment', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: 'a1' } as any)
    vi.mocked(prisma.videoConsultation.findUnique).mockResolvedValue({ id: 'vc-existing' } as any)

    const res = await consultationsPOST(makeReq('/api/video/consultations', 'POST', {
      patientId: 'p1', doctorId: 'd1', scheduledAt: '2026-03-01T10:00:00Z',
      appointmentId: 'a1',
    }))
    expect(res.status).toBe(409)
  })

  it('creates consultation successfully without appointment', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.videoConsultation.create).mockResolvedValue({
      id: 'vc1', roomUrl: 'https://video.example.com/room-abc', roomName: 'room-abc',
      patient: { id: 'p1', firstName: 'John' },
      doctor: { id: 'd1', firstName: 'Dr' },
    } as any)

    const res = await consultationsPOST(makeReq('/api/video/consultations', 'POST', {
      patientId: 'p1', doctorId: 'd1', scheduledAt: '2026-03-01T10:00:00Z',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.roomUrl).toContain('video.example.com')
  })

  it('creates consultation with appointment and marks it virtual', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: 'a1' } as any)
    vi.mocked(prisma.videoConsultation.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.videoConsultation.create).mockResolvedValue({
      id: 'vc1', appointmentId: 'a1',
      patient: { id: 'p1' }, doctor: { id: 'd1' },
    } as any)
    vi.mocked(prisma.appointment.update).mockResolvedValue({} as any)

    const res = await consultationsPOST(makeReq('/api/video/consultations', 'POST', {
      patientId: 'p1', doctorId: 'd1', scheduledAt: '2026-03-01T10:00:00Z',
      appointmentId: 'a1',
    }))

    expect(res.status).toBe(201)
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1' },
        data: expect.objectContaining({ isVirtual: true }),
      })
    )
  })
})
