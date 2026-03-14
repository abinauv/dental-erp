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
  GET as prescriptionGET,
  DELETE as prescriptionDELETE,
} from '@/app/api/prescriptions/[id]/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockAuth(overrides: Record<string, unknown> = {}) {
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

function makeReq(path: string, method = 'GET'): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/prescriptions/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/prescriptions/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await prescriptionGET(makeReq('/api/prescriptions/p1'), makeParams('p1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when prescription not found', async () => {
    mockAuth()
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue(null)
    const res = await prescriptionGET(makeReq('/api/prescriptions/p1'), makeParams('p1') as any)
    expect(res.status).toBe(404)
  })

  it('returns prescription with patient, doctor, medications, and hospital', async () => {
    mockAuth()
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue({
      id: 'p1',
      patient: { id: 'pat1', firstName: 'John', lastName: 'Doe' },
      doctor: { id: 'd1', firstName: 'Dr.', lastName: 'Smith' },
      medications: [
        { id: 'pm1', medication: { id: 'm1', name: 'Amoxicillin', genericName: 'Amoxicillin' } },
      ],
    } as any)
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      name: 'Dental Clinic', phone: '1234567890', email: 'clinic@test.com',
    } as any)

    const res = await prescriptionGET(makeReq('/api/prescriptions/p1'), makeParams('p1') as any)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.patient.firstName).toBe('John')
    expect(body.data.medications).toHaveLength(1)
    expect(body.hospital.name).toBe('Dental Clinic')
  })

  it('scopes query to hospitalId', async () => {
    mockAuth()
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue(null)
    await prescriptionGET(makeReq('/api/prescriptions/p1'), makeParams('p1') as any)

    const call = vi.mocked(prisma.prescription.findFirst).mock.calls[0][0]
    expect(call.where.hospitalId).toBe('h1')
    expect(call.where.id).toBe('p1')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. DELETE /api/prescriptions/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/prescriptions/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await prescriptionDELETE(makeReq('/api/prescriptions/p1', 'DELETE'), makeParams('p1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when prescription not found', async () => {
    mockAuth()
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue(null)
    const res = await prescriptionDELETE(makeReq('/api/prescriptions/p1', 'DELETE'), makeParams('p1') as any)
    expect(res.status).toBe(404)
  })

  it('deletes prescription (hard delete)', async () => {
    mockAuth()
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.prescription.delete).mockResolvedValue({ id: 'p1' } as any)

    const res = await prescriptionDELETE(makeReq('/api/prescriptions/p1', 'DELETE'), makeParams('p1') as any)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(prisma.prescription.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })

  it('restricts to ADMIN and DOCTOR roles', async () => {
    mockAuth()
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.prescription.delete).mockResolvedValue({ id: 'p1' } as any)
    await prescriptionDELETE(makeReq('/api/prescriptions/p1', 'DELETE'), makeParams('p1') as any)

    expect(requireAuthAndRole).toHaveBeenCalledWith(['ADMIN', 'DOCTOR'])
  })
})
