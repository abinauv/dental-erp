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
  GET as medDetailGET,
  PUT as medDetailPUT,
  DELETE as medDetailDELETE,
} from '@/app/api/medications/[id]/route'
import { GET as categoriesGET } from '@/app/api/medications/categories/route'
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
// 1. GET /api/medications/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/medications/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await medDetailGET(makeReq('/api/medications/m1'), makeParams('m1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when medication not found', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findFirst).mockResolvedValue(null)
    const res = await medDetailGET(makeReq('/api/medications/m1'), makeParams('m1') as any)
    expect(res.status).toBe(404)
  })

  it('returns medication detail', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findFirst).mockResolvedValue({
      id: 'm1', name: 'Amoxicillin', genericName: 'Amoxicillin', category: 'Antibiotic',
      form: 'CAPSULE', strength: '500mg', manufacturer: 'Cipla',
    } as any)

    const res = await medDetailGET(makeReq('/api/medications/m1'), makeParams('m1') as any)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Amoxicillin')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. PUT /api/medications/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/medications/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await medDetailPUT(makeReq('/api/medications/m1', 'PUT', { name: 'X' }), makeParams('m1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when medication not found', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findFirst).mockResolvedValue(null)
    const res = await medDetailPUT(makeReq('/api/medications/m1', 'PUT', { name: 'X' }), makeParams('m1') as any)
    expect(res.status).toBe(404)
  })

  it('updates medication fields', async () => {
    mockAuth()
    const existing = {
      id: 'm1', name: 'Amoxicillin', genericName: 'Amoxicillin', category: 'Antibiotic',
      form: 'CAPSULE', strength: '500mg', manufacturer: 'Cipla',
      defaultDosage: '1 cap', defaultFrequency: 'TID', defaultDuration: '5 days',
      contraindications: null, sideEffects: null, isActive: true,
    }
    vi.mocked(prisma.medication.findFirst).mockResolvedValue(existing as any)
    vi.mocked(prisma.medication.update).mockResolvedValue({
      ...existing, strength: '250mg',
    } as any)

    const res = await medDetailPUT(
      makeReq('/api/medications/m1', 'PUT', { strength: '250mg' }),
      makeParams('m1') as any,
    )
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.strength).toBe('250mg')
  })

  it('preserves existing fields on partial update', async () => {
    mockAuth()
    const existing = {
      id: 'm1', name: 'Amoxicillin', genericName: 'Amoxicillin', category: 'Antibiotic',
      form: 'CAPSULE', strength: '500mg', manufacturer: 'Cipla',
      defaultDosage: '1 cap', defaultFrequency: 'TID', defaultDuration: '5 days',
      contraindications: 'Penicillin allergy', sideEffects: 'Nausea', isActive: true,
    }
    vi.mocked(prisma.medication.findFirst).mockResolvedValue(existing as any)
    vi.mocked(prisma.medication.update).mockResolvedValue({ ...existing, name: 'Amox Updated' } as any)

    await medDetailPUT(
      makeReq('/api/medications/m1', 'PUT', { name: 'Amox Updated' }),
      makeParams('m1') as any,
    )

    const updateCall = vi.mocked(prisma.medication.update).mock.calls[0][0]
    expect(updateCall.data.genericName).toBe('Amoxicillin')
    expect(updateCall.data.contraindications).toBe('Penicillin allergy')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. DELETE /api/medications/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/medications/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await medDetailDELETE(makeReq('/api/medications/m1', 'DELETE'), makeParams('m1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when medication not found', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findFirst).mockResolvedValue(null)
    const res = await medDetailDELETE(makeReq('/api/medications/m1', 'DELETE'), makeParams('m1') as any)
    expect(res.status).toBe(404)
  })

  it('soft deletes (deactivates) medication', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findFirst).mockResolvedValue({ id: 'm1' } as any)
    vi.mocked(prisma.medication.update).mockResolvedValue({ id: 'm1', isActive: false } as any)

    const res = await medDetailDELETE(makeReq('/api/medications/m1', 'DELETE'), makeParams('m1') as any)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(prisma.medication.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { isActive: false },
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. GET /api/medications/categories
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/medications/categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await categoriesGET(makeReq('/api/medications/categories'))
    expect(res.status).toBe(401)
  })

  it('returns distinct categories', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findMany).mockResolvedValue([
      { category: 'Antibiotic' },
      { category: 'Analgesic' },
      { category: 'Antiseptic' },
    ] as any)

    const res = await categoriesGET(makeReq('/api/medications/categories'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toEqual(['Antibiotic', 'Analgesic', 'Antiseptic'])
  })

  it('filters out null categories', async () => {
    mockAuth()
    vi.mocked(prisma.medication.findMany).mockResolvedValue([
      { category: 'Antibiotic' },
      { category: null },
    ] as any)

    const res = await categoriesGET(makeReq('/api/medications/categories'))
    const body = await res.json()

    expect(body.data).toEqual(['Antibiotic'])
  })
})
