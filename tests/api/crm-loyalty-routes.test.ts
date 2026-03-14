// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as crmDashboardGET } from '@/app/api/crm/dashboard/route'
import { GET as loyaltyGET, POST as loyaltyPOST } from '@/app/api/loyalty/route'
import { GET as plansGET, POST as plansPOST } from '@/app/api/memberships/plans/route'
import { POST as enrollPOST, GET as enrollGET } from '@/app/api/memberships/enroll/route'
import { GET as referralsGET, POST as referralsPOST } from '@/app/api/referrals/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

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
// 1. GET /api/crm/dashboard
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/crm/dashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await crmDashboardGET(makeReq('/api/crm/dashboard'))
    expect(res.status).toBe(401)
  })

  it('returns CRM dashboard metrics', async () => {
    mockAuth()
    // 9 parallel queries
    vi.mocked(prisma.patientMembership.count)
      .mockResolvedValueOnce(5)  // active memberships
      .mockResolvedValueOnce(8)  // total memberships
    vi.mocked(prisma.patientMembership.findMany).mockResolvedValue([
      { plan: { price: 1000 } },
      { plan: { price: 2000 } },
    ] as any)
    vi.mocked(prisma.referral.count)
      .mockResolvedValueOnce(20)  // total referrals
      .mockResolvedValueOnce(8)   // converted
      .mockResolvedValueOnce(3)   // rewarded
    vi.mocked(prisma.loyaltyTransaction.aggregate).mockResolvedValue({
      _sum: { points: 5000 },
    } as any)
    vi.mocked(prisma.patient.count)
      .mockResolvedValueOnce(100)  // totalActive
      .mockResolvedValueOnce(75)   // recentVisitors

    const res = await crmDashboardGET(makeReq('/api/crm/dashboard'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.memberships.active).toBe(5)
    expect(body.memberships.revenue).toBe(3000)
    expect(body.referrals.total).toBe(20)
    expect(body.loyalty.pointsInCirculation).toBe(5000)
    expect(body.retention.totalActive).toBe(100)
    expect(body.retention.atRisk).toBe(25) // 100 - 75
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET/POST /api/loyalty
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/loyalty', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await loyaltyGET(makeReq('/api/loyalty'))
    expect(res.status).toBe(401)
  })

  it('returns transactions with pagination', async () => {
    mockAuth()
    vi.mocked(prisma.loyaltyTransaction.findMany).mockResolvedValue([
      { id: 'lt1', points: 100, type: 'EARNED', description: 'Visit reward' },
    ] as any)
    vi.mocked(prisma.loyaltyTransaction.count).mockResolvedValue(1)

    const res = await loyaltyGET(makeReq('/api/loyalty'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.transactions).toHaveLength(1)
    expect(body.balance).toBe(0) // no patientId filter
  })

  it('returns balance when filtered by patientId', async () => {
    mockAuth()
    vi.mocked(prisma.loyaltyTransaction.findMany).mockResolvedValue([])
    vi.mocked(prisma.loyaltyTransaction.count).mockResolvedValue(0)
    vi.mocked(prisma.loyaltyTransaction.aggregate).mockResolvedValue({
      _sum: { points: 350 },
    } as any)

    const res = await loyaltyGET(makeReq('/api/loyalty?patientId=p1'))
    const body = await res.json()

    expect(body.balance).toBe(350)
  })
})

describe('POST /api/loyalty', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for unauthorized role', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'DOCTOR' } } })
    const res = await loyaltyPOST(makeReq('/api/loyalty', 'POST', {
      patientId: 'p1', points: 100, type: 'EARNED', description: 'Visit',
    }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await loyaltyPOST(makeReq('/api/loyalty', 'POST', { patientId: 'p1' }))
    const body = await res.json()
    expect(res.status).toBe(400)
  })

  it('returns 404 when patient not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(null)

    const res = await loyaltyPOST(makeReq('/api/loyalty', 'POST', {
      patientId: 'p-none', points: 100, type: 'EARNED', description: 'Visit',
    }))
    expect(res.status).toBe(404)
  })

  it('returns 400 for insufficient points on redemption', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.loyaltyTransaction.aggregate).mockResolvedValue({
      _sum: { points: 50 },
    } as any)

    const res = await loyaltyPOST(makeReq('/api/loyalty', 'POST', {
      patientId: 'p1', points: -100, type: 'REDEEMED', description: 'Discount',
    }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('Insufficient')
  })

  it('creates loyalty transaction successfully', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.loyaltyTransaction.create).mockResolvedValue({
      id: 'lt1', points: 100, type: 'EARNED',
    } as any)

    const res = await loyaltyPOST(makeReq('/api/loyalty', 'POST', {
      patientId: 'p1', points: 100, type: 'EARNED', description: 'Visit reward',
    }))
    expect(res.status).toBe(201)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET/POST /api/memberships/plans
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/memberships/plans', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await plansGET(makeReq('/api/memberships/plans'))
    expect(res.status).toBe(401)
  })

  it('returns plans with member counts', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.findMany).mockResolvedValue([
      { id: 'mp1', name: 'Silver', price: 999, _count: { memberships: 10 } },
      { id: 'mp2', name: 'Gold', price: 1999, _count: { memberships: 5 } },
    ] as any)

    const res = await plansGET(makeReq('/api/memberships/plans'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0]._count.memberships).toBe(10)
  })

  it('filters active plans only', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.findMany).mockResolvedValue([])

    await plansGET(makeReq('/api/memberships/plans?activeOnly=true'))

    expect(prisma.membershipPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    )
  })
})

describe('POST /api/memberships/plans', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for non-admin', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'DOCTOR' } } })
    const res = await plansPOST(makeReq('/api/memberships/plans', 'POST', {
      name: 'Basic', price: 500, duration: 12,
    }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when name missing', async () => {
    mockAuth()
    const res = await plansPOST(makeReq('/api/memberships/plans', 'POST', {
      price: 500, duration: 12,
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid price', async () => {
    mockAuth()
    const res = await plansPOST(makeReq('/api/memberships/plans', 'POST', {
      name: 'Basic', price: -10, duration: 12,
    }))
    expect(res.status).toBe(400)
  })

  it('creates membership plan', async () => {
    mockAuth()
    vi.mocked(prisma.membershipPlan.create).mockResolvedValue({
      id: 'mp1', name: 'Gold', price: 1999, duration: 12,
    } as any)

    const res = await plansPOST(makeReq('/api/memberships/plans', 'POST', {
      name: 'Gold', price: 1999, duration: 12, benefits: ['10% discount', 'Priority'],
    }))
    expect(res.status).toBe(201)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. POST/GET /api/memberships/enroll
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/memberships/enroll', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for unauthorized role', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'DOCTOR' } } })
    const res = await enrollPOST(makeReq('/api/memberships/enroll', 'POST', {
      patientId: 'p1', planId: 'mp1',
    }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await enrollPOST(makeReq('/api/memberships/enroll', 'POST', {}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when patient not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(null)

    const res = await enrollPOST(makeReq('/api/memberships/enroll', 'POST', {
      patientId: 'p-none', planId: 'mp1',
    }))
    expect(res.status).toBe(404)
  })

  it('returns 409 for existing active membership', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.membershipPlan.findUnique).mockResolvedValue({
      id: 'mp1', hospitalId: 'h1', isActive: true, duration: 12,
    } as any)
    vi.mocked(prisma.patientMembership.findFirst).mockResolvedValue({ id: 'existing' } as any)

    const res = await enrollPOST(makeReq('/api/memberships/enroll', 'POST', {
      patientId: 'p1', planId: 'mp1',
    }))
    expect(res.status).toBe(409)
  })

  it('enrolls patient successfully', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.membershipPlan.findUnique).mockResolvedValue({
      id: 'mp1', hospitalId: 'h1', isActive: true, duration: 12,
    } as any)
    vi.mocked(prisma.patientMembership.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.patientMembership.create).mockResolvedValue({
      id: 'pm1', patientId: 'p1', planId: 'mp1',
      plan: { name: 'Gold', price: 1999, duration: 12 },
      patient: { firstName: 'John', lastName: 'Doe', patientId: 'PT001' },
    } as any)

    const res = await enrollPOST(makeReq('/api/memberships/enroll', 'POST', {
      patientId: 'p1', planId: 'mp1',
    }))
    expect(res.status).toBe(201)
  })
})

describe('GET /api/memberships/enroll', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns memberships with pagination', async () => {
    mockAuth()
    vi.mocked(prisma.patientMembership.findMany).mockResolvedValue([
      { id: 'pm1', status: 'ACTIVE', plan: { name: 'Gold' }, patient: { firstName: 'John' } },
    ] as any)
    vi.mocked(prisma.patientMembership.count).mockResolvedValue(1)

    const res = await enrollGET(makeReq('/api/memberships/enroll'))
    const body = await res.json()

    expect(body.memberships).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. GET/POST /api/referrals
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/referrals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await referralsGET(makeReq('/api/referrals'))
    expect(res.status).toBe(401)
  })

  it('returns referrals with summary', async () => {
    mockAuth()
    vi.mocked(prisma.referral.findMany).mockResolvedValue([
      { id: 'r1', referrerPatientId: 'p1', referredName: 'Jane', status: 'PENDING' },
    ] as any)
    vi.mocked(prisma.referral.count)
      .mockResolvedValueOnce(1)   // filtered count
      .mockResolvedValueOnce(10)  // total
      .mockResolvedValueOnce(4)   // converted
      .mockResolvedValueOnce(2)   // rewarded
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: 'p1', firstName: 'John', lastName: 'Doe', patientId: 'PT001' },
    ] as any)

    const res = await referralsGET(makeReq('/api/referrals'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.referrals).toHaveLength(1)
    expect(body.summary.total).toBe(10)
    expect(body.summary.converted).toBe(4)
  })
})

describe('POST /api/referrals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for unauthorized role', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'DOCTOR' } } })
    const res = await referralsPOST(makeReq('/api/referrals', 'POST', {
      referrerPatientId: 'p1', referredName: 'Jane', referredPhone: '9876543210',
    }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await referralsPOST(makeReq('/api/referrals', 'POST', { referrerPatientId: 'p1' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when referrer patient not found', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(null)

    const res = await referralsPOST(makeReq('/api/referrals', 'POST', {
      referrerPatientId: 'p-none', referredName: 'Jane', referredPhone: '9876543210',
    }))
    expect(res.status).toBe(404)
  })

  it('creates referral with generated code', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.referral.findUnique).mockResolvedValue(null) // unique code
    vi.mocked(prisma.referral.create).mockResolvedValue({
      id: 'r1', referralCode: 'REF-ABC123', referredName: 'Jane',
    } as any)

    const res = await referralsPOST(makeReq('/api/referrals', 'POST', {
      referrerPatientId: 'p1', referredName: 'Jane', referredPhone: '9876543210',
    }))
    expect(res.status).toBe(201)
  })
})
