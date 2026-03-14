// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/services/video.service', () => ({
  deleteRoom: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as consultationGET, PUT as consultationPUT } from '@/app/api/video/consultations/[id]/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { deleteRoom } from '@/lib/services/video.service'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockAuth(overrides = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
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

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/video/consultations/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/video/consultations/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await consultationGET(makeReq('/api/video/consultations/vc1'), makeParams('vc1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue(null)

    const res = await consultationGET(makeReq('/api/video/consultations/vc-none'), makeParams('vc-none'))
    expect(res.status).toBe(404)
  })

  it('returns consultation with full details', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'SCHEDULED', roomUrl: 'https://video.test/room',
      patient: { id: 'p1', firstName: 'John', lastName: 'Doe', medicalHistory: { hasAllergies: true } },
      doctor: { id: 'd1', firstName: 'Dr', lastName: 'Smith', specialization: 'General' },
      appointment: { id: 'a1', appointmentNo: 'APT001', scheduledDate: new Date(), scheduledTime: '10:00' },
    } as any)

    const res = await consultationGET(makeReq('/api/video/consultations/vc1'), makeParams('vc1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe('vc1')
    expect(body.patient.medicalHistory.hasAllergies).toBe(true)
    expect(body.doctor.specialization).toBe('General')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. PUT /api/video/consultations/[id] — Actions
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/video/consultations/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'start' }), makeParams('vc1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when consultation not found', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue(null)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'start' }), makeParams('vc1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid action', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({ id: 'vc1', status: 'SCHEDULED' } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'explode' }), makeParams('vc1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid action')
  })

  // ── Start action ──────────────────────────────────────────────────────────

  it('starts a SCHEDULED consultation', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'SCHEDULED', appointmentId: 'a1',
    } as any)
    vi.mocked(prisma.appointment.update).mockResolvedValue({} as any)
    vi.mocked(prisma.videoConsultation.update).mockResolvedValue({
      id: 'vc1', status: 'IN_PROGRESS', startedAt: new Date(),
    } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'start' }), makeParams('vc1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('IN_PROGRESS')
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'IN_PROGRESS' } })
    )
  })

  it('returns 400 when trying to start non-SCHEDULED consultation', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'IN_PROGRESS',
    } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'start' }), makeParams('vc1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('SCHEDULED')
  })

  // ── End action ────────────────────────────────────────────────────────────

  it('ends an IN_PROGRESS consultation and calculates duration', async () => {
    mockAuth()
    const startedAt = new Date(Date.now() - 30 * 60000) // 30 min ago
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'IN_PROGRESS', startedAt, appointmentId: 'a1', roomName: 'room-abc',
    } as any)
    vi.mocked(prisma.appointment.update).mockResolvedValue({} as any)
    vi.mocked(prisma.videoConsultation.update).mockResolvedValue({
      id: 'vc1', status: 'COMPLETED', duration: 30,
    } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'end', notes: 'Good session' }), makeParams('vc1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('COMPLETED')
    expect(deleteRoom).toHaveBeenCalledWith('room-abc')
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) })
    )
  })

  it('returns 400 when trying to end non-IN_PROGRESS consultation', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'SCHEDULED',
    } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'end' }), makeParams('vc1'))
    expect(res.status).toBe(400)
  })

  // ── Cancel action ─────────────────────────────────────────────────────────

  it('cancels a consultation and deletes room', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'SCHEDULED', appointmentId: 'a1', roomName: 'room-xyz',
    } as any)
    vi.mocked(prisma.appointment.update).mockResolvedValue({} as any)
    vi.mocked(prisma.videoConsultation.update).mockResolvedValue({
      id: 'vc1', status: 'CANCELLED',
    } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'cancel' }), makeParams('vc1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('CANCELLED')
    expect(deleteRoom).toHaveBeenCalledWith('room-xyz')
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) })
    )
  })

  it('returns 400 when trying to cancel a COMPLETED consultation', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'COMPLETED',
    } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'cancel' }), makeParams('vc1'))
    expect(res.status).toBe(400)
  })

  // ── No-show action ────────────────────────────────────────────────────────

  it('marks SCHEDULED consultation as no-show', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'SCHEDULED', appointmentId: 'a1', roomName: 'room-ns',
    } as any)
    vi.mocked(prisma.appointment.update).mockResolvedValue({} as any)
    vi.mocked(prisma.videoConsultation.update).mockResolvedValue({
      id: 'vc1', status: 'NO_SHOW',
    } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'no_show' }), makeParams('vc1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('NO_SHOW')
    expect(deleteRoom).toHaveBeenCalledWith('room-ns')
  })

  it('returns 400 when no-show for non-SCHEDULED consultation', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'IN_PROGRESS',
    } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'no_show' }), makeParams('vc1'))
    expect(res.status).toBe(400)
  })

  // ── Update notes action ───────────────────────────────────────────────────

  it('updates notes on consultation', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'COMPLETED',
    } as any)
    vi.mocked(prisma.videoConsultation.update).mockResolvedValue({
      id: 'vc1', notes: 'Updated notes',
    } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'update_notes', notes: 'Updated notes' }), makeParams('vc1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.notes).toBe('Updated notes')
  })

  // ── No linked appointment ─────────────────────────────────────────────────

  it('starts consultation without linked appointment', async () => {
    mockAuth()
    vi.mocked(prisma.videoConsultation.findFirst).mockResolvedValue({
      id: 'vc1', status: 'SCHEDULED', appointmentId: null,
    } as any)
    vi.mocked(prisma.videoConsultation.update).mockResolvedValue({
      id: 'vc1', status: 'IN_PROGRESS',
    } as any)

    const res = await consultationPUT(makeReq('/api/video/consultations/vc1', 'PUT', { action: 'start' }), makeParams('vc1'))
    expect(res.status).toBe(200)
    expect(prisma.appointment.update).not.toHaveBeenCalled()
  })
})
