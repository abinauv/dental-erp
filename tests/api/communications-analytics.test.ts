// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as analyticsGET } from '@/app/api/communications/analytics/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
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

function makeReq(path: string): Request {
  return new Request(`http://localhost${path}`)
}

// Helper to set up all the mocks needed for analytics
function mockAllAnalytics() {
  // SMS mocks
  vi.mocked(prisma.smsLog.count).mockResolvedValue(100)
  vi.mocked(prisma.smsLog.groupBy)
    .mockResolvedValueOnce([ // smsByStatus
      { status: 'DELIVERED', _count: 70 },
      { status: 'SENT', _count: 10 },
      { status: 'FAILED', _count: 5 },
      { status: 'PENDING', _count: 10 },
      { status: 'QUEUED', _count: 5 },
    ] as any)
    .mockResolvedValueOnce([ // smsByDay
      { createdAt: new Date('2026-02-15'), _count: 30 },
      { createdAt: new Date('2026-02-16'), _count: 25 },
    ] as any)
  vi.mocked(prisma.smsLog.aggregate).mockResolvedValue({
    _sum: { cost: { toNumber: () => 250.5 } },
  } as any)

  // Email mocks
  vi.mocked(prisma.emailLog.count)
    .mockResolvedValueOnce(80) // emailStats
    .mockResolvedValueOnce(30) // emailOpened
    .mockResolvedValueOnce(10) // emailClicked
  vi.mocked(prisma.emailLog.groupBy)
    .mockResolvedValueOnce([ // emailByStatus
      { status: 'SENT', _count: 50 },
      { status: 'DELIVERED', _count: 20 },
      { status: 'FAILED', _count: 10 },
    ] as any)
    .mockResolvedValueOnce([ // emailByDay
      { createdAt: new Date('2026-02-15'), _count: 40 },
    ] as any)
    .mockResolvedValueOnce([ // topEmailTemplates
      { templateId: 't2', _count: 15 },
    ] as any)

  // SMS template top
  vi.mocked(prisma.smsLog.groupBy).mockResolvedValueOnce([ // topSmsTemplates (3rd call)
    { templateId: 't1', _count: 25 },
  ] as any)

  // Campaigns
  vi.mocked(prisma.bulkCommunication.findMany).mockResolvedValue([
    {
      id: 'bc1', name: 'Welcome Campaign', channel: 'SMS', status: 'COMPLETED',
      recipientCount: 50, sentCount: 48, failedCount: 2,
      estimatedCost: { toNumber: () => 100 },
      actualCost: { toNumber: () => 96 },
      startedAt: new Date(), completedAt: new Date(), createdAt: new Date(),
    },
  ] as any)

  // Templates
  vi.mocked(prisma.communicationTemplate.findMany).mockResolvedValue([
    { id: 't1', name: 'Appointment Reminder', category: 'APPOINTMENT' },
    { id: 't2', name: 'Welcome Email', category: 'GENERAL' },
  ] as any)
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/communications/analytics
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/communications/analytics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await analyticsGET(makeReq('/api/communications/analytics'))
    expect(res.status).toBe(401)
  })

  it('returns full analytics data with default 30d period', async () => {
    mockAuth()
    mockAllAnalytics()

    const res = await analyticsGET(makeReq('/api/communications/analytics'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.period).toBe('30d')

    // SMS stats
    expect(body.sms.total).toBe(100)
    expect(body.sms.delivered).toBe(70)
    expect(body.sms.sent).toBe(10)
    expect(body.sms.failed).toBe(5)
    expect(body.sms.totalCost).toBe(250.5)
    expect(body.sms.deliveryRate).toBeGreaterThan(0)

    // Email stats
    expect(body.email.total).toBe(80)
    expect(body.email.sent).toBe(70) // SENT + DELIVERED
    expect(body.email.failed).toBe(10)
    expect(body.email.opened).toBe(30)
    expect(body.email.clicked).toBe(10)
    expect(body.email.openRate).toBeGreaterThan(0)
    expect(body.email.clickRate).toBeGreaterThan(0)

    // Campaigns
    expect(body.campaigns).toHaveLength(1)
    expect(body.campaigns[0].name).toBe('Welcome Campaign')
    expect(body.campaigns[0].estimatedCost).toBe(100)
    expect(body.campaigns[0].actualCost).toBe(96)
  })

  it('respects period parameter', async () => {
    mockAuth()
    mockAllAnalytics()

    await analyticsGET(makeReq('/api/communications/analytics?period=7d'))

    // Verify date filter was applied (smsLog.count should be called with a gte filter)
    expect(prisma.smsLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    )
  })

  it('handles "all" period with no date filter', async () => {
    mockAuth()
    mockAllAnalytics()

    await analyticsGET(makeReq('/api/communications/analytics?period=all'))

    expect(prisma.smsLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: undefined,
        }),
      })
    )
  })

  it('returns dailyTrend combining SMS and email data', async () => {
    mockAuth()
    mockAllAnalytics()

    const res = await analyticsGET(makeReq('/api/communications/analytics'))
    const body = await res.json()

    expect(body.dailyTrend).toBeDefined()
    expect(Array.isArray(body.dailyTrend)).toBe(true)
    if (body.dailyTrend.length > 0) {
      expect(body.dailyTrend[0]).toHaveProperty('date')
      expect(body.dailyTrend[0]).toHaveProperty('sms')
      expect(body.dailyTrend[0]).toHaveProperty('email')
    }
  })

  it('returns template performance data', async () => {
    mockAuth()
    mockAllAnalytics()

    const res = await analyticsGET(makeReq('/api/communications/analytics'))
    const body = await res.json()

    expect(body.topTemplates).toBeDefined()
    expect(body.topTemplates.sms).toBeDefined()
    expect(body.topTemplates.email).toBeDefined()
  })

  it('handles zero data gracefully', async () => {
    mockAuth()
    vi.mocked(prisma.smsLog.count).mockResolvedValue(0)
    vi.mocked(prisma.smsLog.groupBy).mockResolvedValue([])
    vi.mocked(prisma.smsLog.aggregate).mockResolvedValue({ _sum: { cost: null } } as any)
    vi.mocked(prisma.emailLog.count).mockResolvedValue(0)
    vi.mocked(prisma.emailLog.groupBy).mockResolvedValue([])
    vi.mocked(prisma.bulkCommunication.findMany).mockResolvedValue([])
    vi.mocked(prisma.communicationTemplate.findMany).mockResolvedValue([])

    const res = await analyticsGET(makeReq('/api/communications/analytics'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sms.total).toBe(0)
    expect(body.sms.deliveryRate).toBe(0)
    expect(body.sms.totalCost).toBe(0)
    expect(body.email.total).toBe(0)
    expect(body.email.openRate).toBe(0)
    expect(body.campaigns).toHaveLength(0)
  })
})
