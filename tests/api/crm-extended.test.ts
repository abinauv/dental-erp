// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { GET as segmentsGET } from '@/app/api/crm/segments/route'
import {
  GET as membershipPlanGET,
  PUT as membershipPlanPUT,
  DELETE as membershipPlanDELETE,
} from '@/app/api/memberships/plans/[id]/route'
import { PUT as referralPUT } from '@/app/api/referrals/[id]/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
    hospitalId: 'h1',
    session: { user: { id: 'u1', name: 'Admin', role: 'ADMIN' } },
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
// 1. GET /api/crm/segments
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/crm/segments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await segmentsGET(makeReq('/api/crm/segments'))
    expect(res.status).toBe(401)
  })

  it('returns segmented patients', async () => {
    mockAuth()
    const now = new Date()
    const recentDate = new Date(now.getTime() - 30 * 86400000) // 30 days ago
    const oldDate = new Date(now.getTime() - 200 * 86400000) // 200 days ago

    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      {
        id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe', phone: '9876543210',
        createdAt: recentDate,
        appointments: [{ scheduledDate: recentDate, status: 'COMPLETED' }],
        invoices: [{ totalAmount: 5000 }],
      },
      {
        id: 'p2', patientId: 'PAT002', firstName: 'Jane', lastName: 'Smith', phone: '9876543211',
        createdAt: oldDate,
        appointments: [{ scheduledDate: oldDate, status: 'COMPLETED' }],
        invoices: [{ totalAmount: 1000 }],
      },
      {
        id: 'p3', patientId: 'PAT003', firstName: 'Bob', lastName: 'Brown', phone: '9876543212',
        createdAt: oldDate,
        appointments: [],
        invoices: [],
      },
    ] as any)

    const res = await segmentsGET(makeReq('/api/crm/segments'))
    const body = await res.json()

    expect(body.totalPatients).toBe(3)
    expect(body.segments).toHaveProperty('new')
    expect(body.segments).toHaveProperty('active')
    expect(body.segments).toHaveProperty('lost')
    expect(body.segments).toHaveProperty('atRisk')
    expect(body.segments).toHaveProperty('highValue')
  })

  it('classifies new patients (registered < 3 months)', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      {
        id: 'p1', patientId: 'PAT001', firstName: 'New', lastName: 'Patient', phone: '9876543210',
        createdAt: new Date(), // just registered
        appointments: [],
        invoices: [],
      },
    ] as any)

    const res = await segmentsGET(makeReq('/api/crm/segments'))
    const body = await res.json()

    expect(body.segments.new.count).toBe(1)
    expect(body.segments.new.patients[0].firstName).toBe('New')
  })

  it('classifies lost patients (no visit > 6 months)', async () => {
    mockAuth()
    const veryOld = new Date()
    veryOld.setFullYear(veryOld.getFullYear() - 2)

    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      {
        id: 'p1', patientId: 'PAT001', firstName: 'Lost', lastName: 'Patient', phone: '9876543210',
        createdAt: veryOld,
        appointments: [], // no visits at all
        invoices: [],
      },
    ] as any)

    const res = await segmentsGET(makeReq('/api/crm/segments'))
    const body = await res.json()

    expect(body.segments.lost.count).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET /api/memberships/plans/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/memberships/plans/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await membershipPlanGET(makeReq('/api/memberships/plans/mp1'), makeParams('mp1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when plan not found', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.findUnique).mockResolvedValue(null)
    const res = await membershipPlanGET(makeReq('/api/memberships/plans/mp1'), makeParams('mp1') as any)
    expect(res.status).toBe(404)
  })

  it('returns 404 when plan belongs to different hospital', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.findUnique).mockResolvedValue({
      id: 'mp1', hospitalId: 'other-hospital', name: 'Gold Plan',
      memberships: [], _count: { memberships: 0 },
    } as any)
    const res = await membershipPlanGET(makeReq('/api/memberships/plans/mp1'), makeParams('mp1') as any)
    expect(res.status).toBe(404)
  })

  it('returns plan with enrolled patients', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.findUnique).mockResolvedValue({
      id: 'mp1', hospitalId: 'h1', name: 'Gold Plan', price: 5000,
      memberships: [
        {
          id: 'm1',
          patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        },
      ],
      _count: { memberships: 1 },
    } as any)

    const res = await membershipPlanGET(makeReq('/api/memberships/plans/mp1'), makeParams('mp1') as any)
    const body = await res.json()

    expect(body.name).toBe('Gold Plan')
    expect(body.memberships).toHaveLength(1)
    expect(body._count.memberships).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. PUT /api/memberships/plans/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/memberships/plans/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await membershipPlanPUT(
      makeReq('/api/memberships/plans/mp1', 'PUT', { name: 'X' }),
      makeParams('mp1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin roles', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'DOCTOR' } } })
    const res = await membershipPlanPUT(
      makeReq('/api/memberships/plans/mp1', 'PUT', { name: 'X' }),
      makeParams('mp1') as any,
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when plan not found', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.updateMany).mockResolvedValue({ count: 0 })
    const res = await membershipPlanPUT(
      makeReq('/api/memberships/plans/mp1', 'PUT', { name: 'Updated' }),
      makeParams('mp1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('updates plan fields', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.membershipPlan.findUnique).mockResolvedValue({
      id: 'mp1', name: 'Updated Plan', price: 7000, isActive: true,
    } as any)

    const res = await membershipPlanPUT(
      makeReq('/api/memberships/plans/mp1', 'PUT', { name: 'Updated Plan', price: 7000 }),
      makeParams('mp1') as any,
    )
    const body = await res.json()

    expect(body.name).toBe('Updated Plan')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. DELETE /api/memberships/plans/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/memberships/plans/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await membershipPlanDELETE(
      makeReq('/api/memberships/plans/mp1', 'DELETE'),
      makeParams('mp1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin roles', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'STAFF' } } })
    const res = await membershipPlanDELETE(
      makeReq('/api/memberships/plans/mp1', 'DELETE'),
      makeParams('mp1') as any,
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when plan not found', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.findUnique).mockResolvedValue(null)
    const res = await membershipPlanDELETE(
      makeReq('/api/memberships/plans/mp1', 'DELETE'),
      makeParams('mp1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('soft deletes plan with existing memberships', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.findUnique).mockResolvedValue({
      id: 'mp1', hospitalId: 'h1', _count: { memberships: 3 },
    } as any)
    vi.mocked(prisma.membershipPlan.update).mockResolvedValue({ id: 'mp1', isActive: false } as any)

    const res = await membershipPlanDELETE(
      makeReq('/api/memberships/plans/mp1', 'DELETE'),
      makeParams('mp1') as any,
    )
    const body = await res.json()

    expect(body.message).toContain('deactivated')
    expect(prisma.membershipPlan.update).toHaveBeenCalled()
  })

  it('hard deletes plan with no memberships', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.findUnique).mockResolvedValue({
      id: 'mp1', hospitalId: 'h1', _count: { memberships: 0 },
    } as any)
    vi.mocked(prisma.membershipPlan.delete).mockResolvedValue({ id: 'mp1' } as any)

    const res = await membershipPlanDELETE(
      makeReq('/api/memberships/plans/mp1', 'DELETE'),
      makeParams('mp1') as any,
    )
    const body = await res.json()

    expect(body.message).toContain('deleted')
    expect(prisma.membershipPlan.delete).toHaveBeenCalledWith({ where: { id: 'mp1' } })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. PUT /api/referrals/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/referrals/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await referralPUT(
      makeReq('/api/referrals/r1', 'PUT', { status: 'CONVERTED' }),
      makeParams('r1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-ADMIN/RECEPTIONIST roles', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'DOCTOR' } } })
    const res = await referralPUT(
      makeReq('/api/referrals/r1', 'PUT', { status: 'CONVERTED' }),
      makeParams('r1') as any,
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when referral not found', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'ADMIN' } } })
    vi.mocked(prisma.referral.findUnique).mockResolvedValue(null)
    const res = await referralPUT(
      makeReq('/api/referrals/r1', 'PUT', { status: 'CONVERTED' }),
      makeParams('r1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 when referral belongs to different hospital', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'ADMIN' } } })
    vi.mocked(prisma.referral.findUnique).mockResolvedValue({
      id: 'r1', hospitalId: 'other-hospital',
    } as any)
    const res = await referralPUT(
      makeReq('/api/referrals/r1', 'PUT', { status: 'CONVERTED' }),
      makeParams('r1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('marks referral as CONVERTED and sets convertedAt', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'ADMIN' } } })
    vi.mocked(prisma.referral.findUnique).mockResolvedValue({
      id: 'r1', hospitalId: 'h1', status: 'PENDING',
    } as any)
    vi.mocked(prisma.referral.update).mockResolvedValue({
      id: 'r1', status: 'CONVERTED', convertedAt: new Date(),
    } as any)

    const res = await referralPUT(
      makeReq('/api/referrals/r1', 'PUT', { status: 'CONVERTED' }),
      makeParams('r1') as any,
    )
    const body = await res.json()

    expect(body.status).toBe('CONVERTED')
    const updateCall = vi.mocked(prisma.referral.update).mock.calls[0][0]
    expect(updateCall.data.convertedAt).toBeInstanceOf(Date)
  })

  it('marks referral as REWARDED and sets rewardGiven', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'RECEPTIONIST' } } })
    vi.mocked(prisma.referral.findUnique).mockResolvedValue({
      id: 'r1', hospitalId: 'h1', status: 'CONVERTED',
    } as any)
    vi.mocked(prisma.referral.update).mockResolvedValue({
      id: 'r1', status: 'REWARDED', rewardGiven: true,
    } as any)

    await referralPUT(
      makeReq('/api/referrals/r1', 'PUT', { status: 'REWARDED' }),
      makeParams('r1') as any,
    )

    const updateCall = vi.mocked(prisma.referral.update).mock.calls[0][0]
    expect(updateCall.data.rewardGiven).toBe(true)
    expect(updateCall.data.rewardGivenAt).toBeInstanceOf(Date)
  })
})
