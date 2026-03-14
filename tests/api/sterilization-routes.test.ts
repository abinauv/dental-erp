// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as instrumentsGET, POST as instrumentsPOST } from '@/app/api/sterilization/instruments/route'
import { GET as logsGET, POST as logsPOST } from '@/app/api/sterilization/logs/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Auth helpers ─────────────────────────────────────────────────────────────

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
// 1. GET/POST /api/sterilization/instruments
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/sterilization/instruments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await instrumentsGET(makeReq('/api/sterilization/instruments'))
    expect(res.status).toBe(401)
  })

  it('returns instruments with log counts', async () => {
    mockAuth()
    vi.mocked(prisma.instrument.findMany).mockResolvedValue([
      { id: 'i1', name: 'Forceps #1', category: 'EXTRACTION', status: 'AVAILABLE', serialNumber: 'SN001', _count: { sterilizationLogs: 12 } },
      { id: 'i2', name: 'Mirror', category: 'EXAMINATION', status: 'IN_USE', serialNumber: 'SN002', _count: { sterilizationLogs: 5 } },
    ] as any)

    const res = await instrumentsGET(makeReq('/api/sterilization/instruments'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.instruments).toHaveLength(2)
    expect(body.instruments[0]._count.sterilizationLogs).toBe(12)
  })

  it('applies search filter', async () => {
    mockAuth()
    vi.mocked(prisma.instrument.findMany).mockResolvedValue([])

    await instrumentsGET(makeReq('/api/sterilization/instruments?search=forceps'))

    expect(prisma.instrument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: { contains: 'forceps' } }),
          ]),
        }),
      })
    )
  })

  it('filters by status and category', async () => {
    mockAuth()
    vi.mocked(prisma.instrument.findMany).mockResolvedValue([])

    await instrumentsGET(makeReq('/api/sterilization/instruments?status=AVAILABLE&category=EXTRACTION'))

    expect(prisma.instrument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'AVAILABLE',
          category: 'EXTRACTION',
        }),
      })
    )
  })
})

describe('POST /api/sterilization/instruments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await instrumentsPOST(makeReq('/api/sterilization/instruments', 'POST', { name: 'Test' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when name or category missing', async () => {
    mockAuth()
    const res = await instrumentsPOST(makeReq('/api/sterilization/instruments', 'POST', { name: 'Test' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('category')
  })

  it('creates instrument successfully', async () => {
    mockAuth()
    vi.mocked(prisma.instrument.create).mockResolvedValue({
      id: 'i1', name: 'Forceps #5', category: 'EXTRACTION', serialNumber: 'SN005',
    } as any)

    const res = await instrumentsPOST(makeReq('/api/sterilization/instruments', 'POST', {
      name: 'Forceps #5',
      category: 'EXTRACTION',
      serialNumber: 'SN005',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.instrument.name).toBe('Forceps #5')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET/POST /api/sterilization/logs
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/sterilization/logs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await logsGET(makeReq('/api/sterilization/logs'))
    expect(res.status).toBe(401)
  })

  it('returns sterilization logs with instrument info', async () => {
    mockAuth()
    vi.mocked(prisma.sterilizationLog.findMany).mockResolvedValue([
      {
        id: 'sl1', instrumentId: 'i1', method: 'AUTOCLAVE', result: 'PASS', cycleNumber: 5,
        temperature: { toNumber: () => 134 },
        pressure: { toNumber: () => 2.1 },
        instrument: { id: 'i1', name: 'Forceps', category: 'EXTRACTION', serialNumber: 'SN001' },
      },
    ] as any)

    const res = await logsGET(makeReq('/api/sterilization/logs'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.logs).toHaveLength(1)
    expect(body.logs[0].temperature).toBe(134)
    expect(body.logs[0].pressure).toBe(2.1)
  })

  it('filters by instrumentId and result', async () => {
    mockAuth()
    vi.mocked(prisma.sterilizationLog.findMany).mockResolvedValue([])

    await logsGET(makeReq('/api/sterilization/logs?instrumentId=i1&result=PASS'))

    expect(prisma.sterilizationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          instrumentId: 'i1',
          result: 'PASS',
        }),
      })
    )
  })
})

describe('POST /api/sterilization/logs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await logsPOST(makeReq('/api/sterilization/logs', 'POST', { instrumentId: 'i1' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('method')
  })

  it('returns 404 when instrument not found', async () => {
    mockAuth()
    vi.mocked(prisma.instrument.findFirst).mockResolvedValue(null)

    const res = await logsPOST(makeReq('/api/sterilization/logs', 'POST', {
      instrumentId: 'i-nonexistent',
      method: 'AUTOCLAVE',
      startedAt: '2026-02-20T10:00:00',
    }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Instrument not found')
  })

  it('creates sterilization log and updates instrument', async () => {
    mockAuth()
    vi.mocked(prisma.instrument.findFirst).mockResolvedValue({
      id: 'i1', sterilizationCycleCount: 10,
    } as any)

    const mockLog = {
      id: 'sl1', instrumentId: 'i1', method: 'AUTOCLAVE', result: 'PASS', cycleNumber: 11,
    }
    vi.mocked(prisma.$transaction).mockResolvedValue([mockLog] as any)

    const res = await logsPOST(makeReq('/api/sterilization/logs', 'POST', {
      instrumentId: 'i1',
      method: 'AUTOCLAVE',
      temperature: 134,
      pressure: 2.1,
      result: 'PASS',
      startedAt: '2026-02-20T10:00:00',
      completedAt: '2026-02-20T10:30:00',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(prisma.$transaction).toHaveBeenCalled()
  })
})
