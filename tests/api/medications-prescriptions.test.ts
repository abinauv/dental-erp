// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
  GET as medicationsGET,
  POST as medicationsPOST,
} from '@/app/api/medications/route'
import {
  GET as prescriptionsGET,
  POST as prescriptionsPOST,
} from '@/app/api/prescriptions/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Auth helpers ─────────────────────────────────────────────────────────────

function mockAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Dr Admin', role: 'ADMIN' },
    session: { user: { id: 'u1', name: 'Dr Admin', role: 'ADMIN' } },
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
// 1. GET /api/medications
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/medications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await medicationsGET(makeReq('/api/medications'))
    expect(res.status).toBe(401)
  })

  it('returns medications with pagination', async () => {
    mockAuth()
    const mockMeds = [
      { id: 'm1', name: 'Amoxicillin', genericName: 'Amoxicillin', category: 'ANTIBIOTIC' },
      { id: 'm2', name: 'Ibuprofen', genericName: 'Ibuprofen', category: 'ANALGESIC' },
    ]
    vi.mocked(prisma.medication.findMany).mockResolvedValue(mockMeds as any)
    vi.mocked(prisma.medication.count).mockResolvedValue(2)

    const res = await medicationsGET(makeReq('/api/medications'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
    expect(body.pagination.limit).toBe(50) // default
  })

  it('applies search filter', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findMany).mockResolvedValue([])
    vi.mocked(prisma.medication.count).mockResolvedValue(0)

    await medicationsGET(makeReq('/api/medications?search=amox'))

    expect(prisma.medication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: { contains: 'amox', mode: 'insensitive' } }),
          ]),
        }),
      })
    )
  })

  it('applies category filter', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findMany).mockResolvedValue([])
    vi.mocked(prisma.medication.count).mockResolvedValue(0)

    await medicationsGET(makeReq('/api/medications?category=ANTIBIOTIC'))

    expect(prisma.medication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'ANTIBIOTIC' }),
      })
    )
  })

  it('applies active filter', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findMany).mockResolvedValue([])
    vi.mocked(prisma.medication.count).mockResolvedValue(0)

    await medicationsGET(makeReq('/api/medications?active=true'))

    expect(prisma.medication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    )
  })

  it('paginates correctly', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findMany).mockResolvedValue([])
    vi.mocked(prisma.medication.count).mockResolvedValue(200)

    const res = await medicationsGET(makeReq('/api/medications?page=3&limit=25'))
    const body = await res.json()

    expect(prisma.medication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 25 })
    )
    expect(body.pagination.pages).toBe(8)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/medications
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/medications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await medicationsPOST(makeReq('/api/medications', 'POST', { name: 'Test' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    mockAuth()
    const res = await medicationsPOST(makeReq('/api/medications', 'POST', {}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('name')
  })

  it('creates medication successfully', async () => {
    mockAuth()
    const mockMed = {
      id: 'm1',
      name: 'Amoxicillin',
      genericName: 'Amoxicillin',
      category: 'ANTIBIOTIC',
      form: 'CAPSULE',
      strength: '500mg',
    }
    vi.mocked(prisma.medication.create).mockResolvedValue(mockMed as any)

    const res = await medicationsPOST(makeReq('/api/medications', 'POST', {
      name: 'Amoxicillin',
      genericName: 'Amoxicillin',
      category: 'ANTIBIOTIC',
      form: 'CAPSULE',
      strength: '500mg',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Amoxicillin')
    expect(prisma.medication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hospitalId: 'h1',
        name: 'Amoxicillin',
        genericName: 'Amoxicillin',
      }),
    })
  })

  it('sets null for optional fields when not provided', async () => {
    mockAuth()
    vi.mocked(prisma.medication.create).mockResolvedValue({ id: 'm1' } as any)

    await medicationsPOST(makeReq('/api/medications', 'POST', { name: 'Test Med' }))

    expect(prisma.medication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        genericName: null,
        category: null,
        form: null,
        manufacturer: null,
      }),
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/prescriptions
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/prescriptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await prescriptionsGET(makeReq('/api/prescriptions'))
    expect(res.status).toBe(401)
  })

  it('returns prescriptions with includes', async () => {
    mockAuth()
    const mockRx = [
      {
        id: 'rx1',
        prescriptionNo: 'RX20260001',
        patient: { id: 'p1', patientId: 'PT001', firstName: 'John', lastName: 'Doe', phone: '9876543210', dateOfBirth: null },
        doctor: { id: 's1', firstName: 'Dr', lastName: 'Smith' },
        medications: [
          { id: 'pm1', medication: { id: 'm1', name: 'Amoxicillin', genericName: 'Amoxicillin' } },
        ],
      },
    ]
    vi.mocked(prisma.prescription.findMany).mockResolvedValue(mockRx as any)
    vi.mocked(prisma.prescription.count).mockResolvedValue(1)

    const res = await prescriptionsGET(makeReq('/api/prescriptions'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].prescriptionNo).toBe('RX20260001')
    expect(body.pagination.total).toBe(1)
  })

  it('filters by patientId', async () => {
    mockAuth()
    vi.mocked(prisma.prescription.findMany).mockResolvedValue([])
    vi.mocked(prisma.prescription.count).mockResolvedValue(0)

    await prescriptionsGET(makeReq('/api/prescriptions?patientId=p1'))

    expect(prisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: 'p1' }),
      })
    )
  })

  it('filters by doctorId', async () => {
    mockAuth()
    vi.mocked(prisma.prescription.findMany).mockResolvedValue([])
    vi.mocked(prisma.prescription.count).mockResolvedValue(0)

    await prescriptionsGET(makeReq('/api/prescriptions?doctorId=s1'))

    expect(prisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ doctorId: 's1' }),
      })
    )
  })

  it('applies search filter', async () => {
    mockAuth()
    vi.mocked(prisma.prescription.findMany).mockResolvedValue([])
    vi.mocked(prisma.prescription.count).mockResolvedValue(0)

    await prescriptionsGET(makeReq('/api/prescriptions?search=RX2026'))

    expect(prisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. POST /api/prescriptions
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/prescriptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await prescriptionsPOST(makeReq('/api/prescriptions', 'POST', {}))
    expect(res.status).toBe(401)
  })

  it('returns 400 when patientId is missing', async () => {
    mockAuth()
    const res = await prescriptionsPOST(makeReq('/api/prescriptions', 'POST', {
      medications: [{ medicationName: 'Amox', dosage: '500mg' }],
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Patient')
  })

  it('returns 400 when medications array is empty', async () => {
    mockAuth()
    const res = await prescriptionsPOST(makeReq('/api/prescriptions', 'POST', {
      patientId: 'p1',
      medications: [],
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
  })

  it('returns 404 when patient not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)

    const res = await prescriptionsPOST(makeReq('/api/prescriptions', 'POST', {
      patientId: 'p-nonexistent',
      medications: [{ medicationName: 'Amox', dosage: '500mg', frequency: 'TID', duration: '7 days' }],
    }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Patient not found')
  })

  it('returns 400 when doctor staff record not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null)

    const res = await prescriptionsPOST(makeReq('/api/prescriptions', 'POST', {
      patientId: 'p1',
      medications: [{ medicationName: 'Amox', dosage: '500mg', frequency: 'TID', duration: '7 days' }],
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Doctor staff record')
  })

  it('creates prescription with generated number', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue(null) // no previous
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 's1' } as any)
    vi.mocked(prisma.prescription.create).mockResolvedValue({
      id: 'rx1',
      prescriptionNo: 'RX20260001',
      patient: { patientId: 'PT001', firstName: 'John', lastName: 'Doe' },
      doctor: { firstName: 'Dr', lastName: 'Smith' },
      medications: [{ medicationName: 'Amoxicillin' }],
    } as any)

    const res = await prescriptionsPOST(makeReq('/api/prescriptions', 'POST', {
      patientId: 'p1',
      diagnosis: 'Dental infection',
      medications: [
        { medicationName: 'Amoxicillin', dosage: '500mg', frequency: 'TID', duration: '7 days' },
      ],
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(prisma.prescription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'h1',
          prescriptionNo: expect.stringMatching(/^RX\d{8}$/),
          patientId: 'p1',
          doctorId: 's1',
          medications: {
            create: expect.arrayContaining([
              expect.objectContaining({ medicationName: 'Amoxicillin', dosage: '500mg' }),
            ]),
          },
        }),
      })
    )
  })

  it('increments prescription number from last existing', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.prescription.findFirst).mockResolvedValue({ prescriptionNo: 'RX20260015' } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 's1' } as any)
    vi.mocked(prisma.prescription.create).mockResolvedValue({ id: 'rx2' } as any)

    await prescriptionsPOST(makeReq('/api/prescriptions', 'POST', {
      patientId: 'p1',
      medications: [{ medicationName: 'Ibuprofen', dosage: '400mg', frequency: 'BID', duration: '5 days' }],
    }))

    expect(prisma.prescription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prescriptionNo: `RX${new Date().getFullYear()}0016`,
        }),
      })
    )
  })
})
