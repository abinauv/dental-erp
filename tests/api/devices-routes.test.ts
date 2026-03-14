// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { POST as registerPOST } from '@/app/api/devices/register/route'
import { POST as dataPOST, GET as dataGET } from '@/app/api/devices/data/route'
import { GET as statusGET, PUT as statusPUT, DELETE as statusDELETE } from '@/app/api/devices/status/route'
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
// 1. POST /api/devices/register
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/devices/register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await registerPOST(makeReq('/api/devices/register', 'POST', { name: 'Test' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when name or type missing', async () => {
    mockAuth()
    const res = await registerPOST(makeReq('/api/devices/register', 'POST', { name: 'Chair 1' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('type')
  })

  it('returns 400 for invalid device type', async () => {
    mockAuth()
    const res = await registerPOST(makeReq('/api/devices/register', 'POST', {
      name: 'Chair 1',
      type: 'INVALID_TYPE',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid device type')
  })

  it('returns 409 for duplicate serial number', async () => {
    mockAuth()
    vi.mocked(prisma.device.findFirst).mockResolvedValue({ id: 'd1' } as any)

    const res = await registerPOST(makeReq('/api/devices/register', 'POST', {
      name: 'Chair 1',
      type: 'DENTAL_CHAIR',
      serialNumber: 'SN-DUP',
    }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('serial number already exists')
  })

  it('registers device successfully with OFFLINE status', async () => {
    mockAuth()
    vi.mocked(prisma.device.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.device.create).mockResolvedValue({
      id: 'd1', name: 'Chair 1', type: 'DENTAL_CHAIR', status: 'OFFLINE',
      serialNumber: 'SN-001', hospitalId: 'h1',
    } as any)

    const res = await registerPOST(makeReq('/api/devices/register', 'POST', {
      name: 'Chair 1',
      type: 'DENTAL_CHAIR',
      serialNumber: 'SN-001',
      location: 'Room 1',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.status).toBe('OFFLINE')
    expect(body.type).toBe('DENTAL_CHAIR')
    expect(prisma.device.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'h1',
          status: 'OFFLINE',
        }),
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST/GET /api/devices/data
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/devices/data', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when deviceId or data missing', async () => {
    const res = await dataPOST(makeReq('/api/devices/data', 'POST', { deviceId: 'd1' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('data')
  })

  it('returns 404 when device not found', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue(null)

    const res = await dataPOST(makeReq('/api/devices/data', 'POST', {
      deviceId: 'd-nonexistent',
      data: { temperature: 36.5 },
    }))

    expect(res.status).toBe(404)
  })

  it('records data and updates device status to ONLINE', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.deviceDataLog.create).mockResolvedValue({ id: 'log1' } as any)
    vi.mocked(prisma.device.update).mockResolvedValue({} as any)

    const res = await dataPOST(makeReq('/api/devices/data', 'POST', {
      deviceId: 'd1',
      data: { temperature: 36.5 },
      eventType: 'READING',
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.recorded).toBe(true)
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ONLINE' }),
      })
    )
  })

  it('sets device status to ERROR on error event', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.deviceDataLog.create).mockResolvedValue({ id: 'log2' } as any)
    vi.mocked(prisma.device.update).mockResolvedValue({} as any)

    await dataPOST(makeReq('/api/devices/data', 'POST', {
      deviceId: 'd1',
      data: { error: 'sensor fault' },
      eventType: 'ERROR',
    }))

    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ERROR' }),
      })
    )
  })
})

describe('GET /api/devices/data', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await dataGET(makeReq('/api/devices/data?deviceId=d1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when deviceId missing', async () => {
    mockAuth()
    const res = await dataGET(makeReq('/api/devices/data'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('deviceId')
  })

  it('returns 404 when device not in hospital', async () => {
    mockAuth()
    vi.mocked(prisma.device.findFirst).mockResolvedValue(null)

    const res = await dataGET(makeReq('/api/devices/data?deviceId=d-other'))
    expect(res.status).toBe(404)
  })

  it('returns device data logs', async () => {
    mockAuth()
    vi.mocked(prisma.device.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.deviceDataLog.findMany).mockResolvedValue([
      { id: 'log1', data: { temp: 36.5 }, eventType: 'READING', timestamp: new Date() },
      { id: 'log2', data: { temp: 36.6 }, eventType: 'READING', timestamp: new Date() },
    ] as any)

    const res = await dataGET(makeReq('/api/devices/data?deviceId=d1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.logs).toHaveLength(2)
    expect(body.total).toBe(2)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET/PUT/DELETE /api/devices/status
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/devices/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await statusGET(makeReq('/api/devices/status'))
    expect(res.status).toBe(401)
  })

  it('returns devices with summary stats', async () => {
    mockAuth()
    vi.mocked(prisma.device.findMany).mockResolvedValue([
      { id: 'd1', name: 'Chair 1', status: 'ONLINE', lastPingAt: new Date(), dataLogs: [] },
      { id: 'd2', name: 'Chair 2', status: 'OFFLINE', lastPingAt: null, dataLogs: [] },
    ] as any)
    vi.mocked(prisma.device.updateMany).mockResolvedValue({ count: 0 } as any)

    const res = await statusGET(makeReq('/api/devices/status'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.devices).toHaveLength(2)
    expect(body.summary.total).toBe(2)
    expect(body.summary.online).toBe(1)
    expect(body.summary.offline).toBe(1)
  })

  it('marks stale online devices as offline', async () => {
    mockAuth()
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
    vi.mocked(prisma.device.findMany).mockResolvedValue([
      { id: 'd1', name: 'Stale', status: 'ONLINE', lastPingAt: tenMinAgo, dataLogs: [] },
    ] as any)
    vi.mocked(prisma.device.updateMany).mockResolvedValue({ count: 1 } as any)

    const res = await statusGET(makeReq('/api/devices/status'))
    const body = await res.json()

    expect(prisma.device.updateMany).toHaveBeenCalled()
    // After marking stale, the device status should be OFFLINE in the response
    expect(body.devices[0].status).toBe('OFFLINE')
  })
})

describe('PUT /api/devices/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when id missing', async () => {
    mockAuth()
    const res = await statusPUT(makeReq('/api/devices/status', 'PUT', { name: 'Updated' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('id')
  })

  it('returns 404 when device not found', async () => {
    mockAuth()
    vi.mocked(prisma.device.findFirst).mockResolvedValue(null)

    const res = await statusPUT(makeReq('/api/devices/status', 'PUT', { id: 'd-nonexistent' }))
    expect(res.status).toBe(404)
  })

  it('updates device details', async () => {
    mockAuth()
    vi.mocked(prisma.device.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.device.update).mockResolvedValue({
      id: 'd1', name: 'Updated Chair', status: 'MAINTENANCE',
    } as any)

    const res = await statusPUT(makeReq('/api/devices/status', 'PUT', {
      id: 'd1',
      name: 'Updated Chair',
      status: 'MAINTENANCE',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.name).toBe('Updated Chair')
  })
})

describe('DELETE /api/devices/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when id missing', async () => {
    mockAuth()
    const res = await statusDELETE(makeReq('/api/devices/status', 'DELETE'))
    const body = await res.json()

    expect(res.status).toBe(400)
  })

  it('returns 404 when device not found', async () => {
    mockAuth()
    vi.mocked(prisma.device.findFirst).mockResolvedValue(null)

    const res = await statusDELETE(makeReq('/api/devices/status?id=d-nonexistent', 'DELETE'))
    expect(res.status).toBe(404)
  })

  it('deletes device successfully', async () => {
    mockAuth()
    vi.mocked(prisma.device.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.device.delete).mockResolvedValue({} as any)

    const res = await statusDELETE(makeReq('/api/devices/status?id=d1', 'DELETE'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.deleted).toBe(true)
  })
})
