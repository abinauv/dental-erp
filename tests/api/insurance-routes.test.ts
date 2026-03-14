// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/billing-utils', () => ({
  generateClaimNo: vi.fn(() => 'CLM2026-0001'),
}))

vi.mock('@prisma/client', () => ({
  InsuranceClaimStatus: {
    DRAFT: 'DRAFT', SUBMITTED: 'SUBMITTED', UNDER_REVIEW: 'UNDER_REVIEW',
    APPROVED: 'APPROVED', PARTIALLY_APPROVED: 'PARTIALLY_APPROVED',
    REJECTED: 'REJECTED', SETTLED: 'SETTLED',
  },
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as claimsGET, POST as claimsPOST } from '@/app/api/insurance-claims/route'
import { GET as claimDetailGET, PUT as claimPUT, DELETE as claimDELETE } from '@/app/api/insurance-claims/[id]/route'
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
// 1. GET /api/insurance-claims
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/insurance-claims', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await claimsGET(makeReq('/api/insurance-claims'))
    expect(res.status).toBe(401)
  })

  it('returns claims with pagination and summary', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findMany).mockResolvedValue([
      { id: 'c1', claimNumber: 'CLM001', status: 'DRAFT', patient: { firstName: 'John', lastName: 'Doe' } },
    ] as any)
    vi.mocked(prisma.insuranceClaim.count).mockResolvedValue(1)
    vi.mocked(prisma.insuranceClaim.aggregate)
      .mockResolvedValueOnce({ _sum: { claimAmount: 10000 } } as any)
      .mockResolvedValueOnce({ _sum: { approvedAmount: 8000 } } as any)
      .mockResolvedValueOnce({ _sum: { settledAmount: 5000 } } as any)

    const res = await claimsGET(makeReq('/api/insurance-claims'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.claims).toHaveLength(1)
    expect(body.summary.totalClaimed).toBe(10000)
    expect(body.summary.totalApproved).toBe(8000)
    expect(body.summary.totalSettled).toBe(5000)
    expect(body.pagination.total).toBe(1)
  })

  it('filters by status, patientId, provider', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findMany).mockResolvedValue([])
    vi.mocked(prisma.insuranceClaim.count).mockResolvedValue(0)
    vi.mocked(prisma.insuranceClaim.aggregate).mockResolvedValue({ _sum: {} } as any)

    await claimsGET(makeReq('/api/insurance-claims?status=DRAFT&patientId=p1&provider=ICICI'))

    expect(prisma.insuranceClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'DRAFT',
          patientId: 'p1',
          insuranceProvider: { contains: 'ICICI' },
        }),
      })
    )
  })

  it('filters by date range', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findMany).mockResolvedValue([])
    vi.mocked(prisma.insuranceClaim.count).mockResolvedValue(0)
    vi.mocked(prisma.insuranceClaim.aggregate).mockResolvedValue({ _sum: {} } as any)

    await claimsGET(makeReq('/api/insurance-claims?dateFrom=2026-01-01&dateTo=2026-02-28'))

    expect(prisma.insuranceClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submissionDate: expect.objectContaining({
            gte: new Date('2026-01-01'),
          }),
        }),
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/insurance-claims
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/insurance-claims', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await claimsPOST(makeReq('/api/insurance-claims', 'POST', {}))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-ADMIN/ACCOUNTANT roles', async () => {
    mockAuth({ session: { user: { id: 'u1', name: 'Staff', role: 'STAFF' } } })
    const res = await claimsPOST(makeReq('/api/insurance-claims', 'POST', {
      patientId: 'p1', insuranceProvider: 'ICICI', policyNumber: 'POL001', claimAmount: 5000,
    }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await claimsPOST(makeReq('/api/insurance-claims', 'POST', {}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when claimAmount is invalid', async () => {
    mockAuth()
    const res = await claimsPOST(makeReq('/api/insurance-claims', 'POST', {
      patientId: 'p1', insuranceProvider: 'ICICI', policyNumber: 'POL001', claimAmount: 0,
    }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when patient not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(null)

    const res = await claimsPOST(makeReq('/api/insurance-claims', 'POST', {
      patientId: 'p-none', insuranceProvider: 'ICICI', policyNumber: 'POL001', claimAmount: 5000,
    }))
    expect(res.status).toBe(404)
  })

  it('validates invoice ownership', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([{ id: 'inv1' }] as any) // only 1 found but 2 sent

    const res = await claimsPOST(makeReq('/api/insurance-claims', 'POST', {
      patientId: 'p1', insuranceProvider: 'ICICI', policyNumber: 'POL001', claimAmount: 5000,
      invoiceIds: ['inv1', 'inv-missing'],
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('invoices not found')
  })

  it('creates claim successfully', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.insuranceClaim.create).mockResolvedValue({
      id: 'c1', claimNumber: 'CLM2026-0001', status: 'DRAFT',
    } as any)
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({
      id: 'c1', claimNumber: 'CLM2026-0001', status: 'DRAFT',
      patient: { id: 'p1', firstName: 'John', lastName: 'Doe' },
    } as any)

    const res = await claimsPOST(makeReq('/api/insurance-claims', 'POST', {
      patientId: 'p1', insuranceProvider: 'ICICI', policyNumber: 'POL001', claimAmount: 5000,
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.claimNumber).toBe('CLM2026-0001')
    expect(body.status).toBe('DRAFT')
  })

  it('links invoices to claim when provided', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([{ id: 'inv1' }, { id: 'inv2' }] as any)
    vi.mocked(prisma.insuranceClaim.create).mockResolvedValue({ id: 'c1' } as any)
    vi.mocked(prisma.invoice.updateMany).mockResolvedValue({ count: 2 } as any)
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({ id: 'c1' } as any)

    await claimsPOST(makeReq('/api/insurance-claims', 'POST', {
      patientId: 'p1', insuranceProvider: 'ICICI', policyNumber: 'POL001', claimAmount: 5000,
      invoiceIds: ['inv1', 'inv2'],
    }))

    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['inv1', 'inv2'] }, hospitalId: 'h1' },
        data: { insuranceClaimId: 'c1' },
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/insurance-claims/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/insurance-claims/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await claimDetailGET(makeReq('/api/insurance-claims/c1'), makeParams('c1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when claim not found', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(null)

    const res = await claimDetailGET(makeReq('/api/insurance-claims/c-none'), makeParams('c-none'))
    expect(res.status).toBe(404)
  })

  it('returns claim detail with patient and invoices', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({
      id: 'c1', claimNumber: 'CLM001', status: 'DRAFT',
      patient: { id: 'p1', firstName: 'John', lastName: 'Doe' },
      invoices: [{ id: 'inv1', invoiceNo: 'INV001', totalAmount: 5000 }],
    } as any)

    const res = await claimDetailGET(makeReq('/api/insurance-claims/c1'), makeParams('c1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.claimNumber).toBe('CLM001')
    expect(body.invoices).toHaveLength(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. PUT /api/insurance-claims/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/insurance-claims/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await claimPUT(makeReq('/api/insurance-claims/c1', 'PUT', {}), makeParams('c1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-ADMIN/ACCOUNTANT', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'DOCTOR' } } })
    const res = await claimPUT(makeReq('/api/insurance-claims/c1', 'PUT', { notes: 'x' }), makeParams('c1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when claim not found', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(null)

    const res = await claimPUT(makeReq('/api/insurance-claims/c1', 'PUT', { notes: 'x' }), makeParams('c1'))
    expect(res.status).toBe(404)
  })

  it('validates status transitions — DRAFT can only go to SUBMITTED', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({
      id: 'c1', status: 'DRAFT', hospitalId: 'h1',
    } as any)

    const res = await claimPUT(makeReq('/api/insurance-claims/c1', 'PUT', { status: 'APPROVED' }), makeParams('c1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Cannot transition')
  })

  it('allows DRAFT to SUBMITTED transition', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({
      id: 'c1', status: 'DRAFT', hospitalId: 'h1',
    } as any)
    vi.mocked(prisma.insuranceClaim.update).mockResolvedValue({
      id: 'c1', status: 'SUBMITTED', submissionDate: new Date(),
    } as any)

    const res = await claimPUT(makeReq('/api/insurance-claims/c1', 'PUT', { status: 'SUBMITTED' }), makeParams('c1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('SUBMITTED')
  })

  it('sets approvalDate on APPROVED status', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({
      id: 'c1', status: 'SUBMITTED', hospitalId: 'h1',
    } as any)
    vi.mocked(prisma.insuranceClaim.update).mockResolvedValue({
      id: 'c1', status: 'APPROVED',
    } as any)

    await claimPUT(makeReq('/api/insurance-claims/c1', 'PUT', { status: 'APPROVED', approvedAmount: 4500 }), makeParams('c1'))

    expect(prisma.insuranceClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          approvalDate: expect.any(Date),
          approvedAmount: 4500,
        }),
      })
    )
  })

  it('sets rejectionDate and reason on REJECTED status', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({
      id: 'c1', status: 'UNDER_REVIEW', hospitalId: 'h1',
    } as any)
    vi.mocked(prisma.insuranceClaim.update).mockResolvedValue({
      id: 'c1', status: 'REJECTED',
    } as any)

    await claimPUT(makeReq('/api/insurance-claims/c1', 'PUT', {
      status: 'REJECTED', rejectionReason: 'Incomplete docs',
    }), makeParams('c1'))

    expect(prisma.insuranceClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionDate: expect.any(Date),
          rejectionReason: 'Incomplete docs',
        }),
      })
    )
  })

  it('prevents transition from terminal states (REJECTED, SETTLED)', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({
      id: 'c1', status: 'SETTLED', hospitalId: 'h1',
    } as any)

    const res = await claimPUT(makeReq('/api/insurance-claims/c1', 'PUT', { status: 'APPROVED' }), makeParams('c1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when no valid fields to update', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({
      id: 'c1', status: 'APPROVED', hospitalId: 'h1',
    } as any)

    const res = await claimPUT(makeReq('/api/insurance-claims/c1', 'PUT', {}), makeParams('c1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No valid fields')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. DELETE /api/insurance-claims/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/insurance-claims/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await claimDELETE(makeReq('/api/insurance-claims/c1', 'DELETE'), makeParams('c1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-ADMIN', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'ACCOUNTANT' } } })
    const res = await claimDELETE(makeReq('/api/insurance-claims/c1', 'DELETE'), makeParams('c1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when claim not found', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue(null)

    const res = await claimDELETE(makeReq('/api/insurance-claims/c-none', 'DELETE'), makeParams('c-none'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when trying to delete non-DRAFT claim', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({
      id: 'c1', status: 'SUBMITTED', hospitalId: 'h1',
    } as any)

    const res = await claimDELETE(makeReq('/api/insurance-claims/c1', 'DELETE'), makeParams('c1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('draft claims')
  })

  it('deletes draft claim and unlinks invoices', async () => {
    mockAuth()
    vi.mocked(prisma.insuranceClaim.findUnique).mockResolvedValue({
      id: 'c1', status: 'DRAFT', hospitalId: 'h1',
    } as any)
    vi.mocked(prisma.invoice.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.insuranceClaim.delete).mockResolvedValue({} as any)

    const res = await claimDELETE(makeReq('/api/insurance-claims/c1', 'DELETE'), makeParams('c1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toContain('deleted')
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { insuranceClaimId: 'c1', hospitalId: 'h1' },
        data: { insuranceClaimId: null },
      })
    )
  })
})
