// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
  GET as automationsGET,
  POST as automationsPOST,
  PUT as automationsPUT,
  DELETE as automationsDELETE,
} from '@/app/api/communications/automations/route'
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
// 1. GET /api/communications/automations
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/communications/automations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await automationsGET(makeReq('/api/communications/automations'))
    expect(res.status).toBe(401)
  })

  it('returns list of automations', async () => {
    mockAuth()
    vi.mocked(prisma.marketingAutomation.findMany).mockResolvedValue([
      { id: 'ma1', name: 'Birthday Reminder', trigger: { type: 'BIRTHDAY_UPCOMING' }, action: { type: 'SEND_SMS' }, isActive: true },
      { id: 'ma2', name: 'No Visit Follow-up', trigger: { type: 'NO_VISIT' }, action: { type: 'SEND_EMAIL' }, isActive: false },
    ] as any)

    const res = await automationsGET(makeReq('/api/communications/automations'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.automations).toHaveLength(2)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/communications/automations
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/communications/automations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await automationsPOST(makeReq('/api/communications/automations', 'POST', {}))
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields missing', async () => {
    mockAuth()
    const res = await automationsPOST(makeReq('/api/communications/automations', 'POST', { name: 'Test' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid trigger type', async () => {
    mockAuth()
    const res = await automationsPOST(makeReq('/api/communications/automations', 'POST', {
      name: 'Test', trigger: { type: 'INVALID_TRIGGER' }, action: { type: 'SEND_SMS' },
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid trigger')
  })

  it('returns 400 for invalid action type', async () => {
    mockAuth()
    const res = await automationsPOST(makeReq('/api/communications/automations', 'POST', {
      name: 'Test', trigger: { type: 'BIRTHDAY_UPCOMING' }, action: { type: 'DELETE_ALL' },
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid action')
  })

  it('creates automation successfully', async () => {
    mockAuth()
    vi.mocked(prisma.marketingAutomation.create).mockResolvedValue({
      id: 'ma1', name: 'Birthday SMS', isActive: true,
      trigger: { type: 'BIRTHDAY_UPCOMING', daysBeforeEvent: 3 },
      action: { type: 'SEND_SMS', template: 'Happy Birthday!' },
    } as any)

    const res = await automationsPOST(makeReq('/api/communications/automations', 'POST', {
      name: 'Birthday SMS',
      trigger: { type: 'BIRTHDAY_UPCOMING', daysBeforeEvent: 3 },
      action: { type: 'SEND_SMS', template: 'Happy Birthday!' },
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.automation.name).toBe('Birthday SMS')
    expect(body.automation.isActive).toBe(true)
  })

  it('accepts all valid trigger types', async () => {
    const validTriggers = [
      'NO_VISIT', 'BIRTHDAY_UPCOMING', 'TREATMENT_PLAN_PENDING',
      'MEMBERSHIP_EXPIRING', 'POST_APPOINTMENT', 'PAYMENT_OVERDUE',
    ]

    for (const triggerType of validTriggers) {
      vi.clearAllMocks()
      mockAuth()
      vi.mocked(prisma.marketingAutomation.create).mockResolvedValue({ id: 'ma1' } as any)

      const res = await automationsPOST(makeReq('/api/communications/automations', 'POST', {
        name: 'Test', trigger: { type: triggerType }, action: { type: 'SEND_SMS' },
      }))
      expect(res.status).toBe(201)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. PUT /api/communications/automations
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/communications/automations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await automationsPUT(makeReq('/api/communications/automations', 'PUT', {}))
    expect(res.status).toBe(401)
  })

  it('returns 400 when id missing', async () => {
    mockAuth()
    const res = await automationsPUT(makeReq('/api/communications/automations', 'PUT', { name: 'Updated' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when automation not found', async () => {
    mockAuth()
    vi.mocked(prisma.marketingAutomation.findFirst).mockResolvedValue(null)

    const res = await automationsPUT(makeReq('/api/communications/automations', 'PUT', { id: 'ma-none', name: 'Updated' }))
    expect(res.status).toBe(404)
  })

  it('updates automation successfully', async () => {
    mockAuth()
    vi.mocked(prisma.marketingAutomation.findFirst).mockResolvedValue({ id: 'ma1' } as any)
    vi.mocked(prisma.marketingAutomation.update).mockResolvedValue({
      id: 'ma1', name: 'Updated Name', isActive: false,
    } as any)

    const res = await automationsPUT(makeReq('/api/communications/automations', 'PUT', {
      id: 'ma1', name: 'Updated Name', isActive: false,
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.automation.name).toBe('Updated Name')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. DELETE /api/communications/automations
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/communications/automations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await automationsDELETE(makeReq('/api/communications/automations', 'DELETE', {}))
    expect(res.status).toBe(401)
  })

  it('returns 400 when id missing', async () => {
    mockAuth()
    const res = await automationsDELETE(makeReq('/api/communications/automations', 'DELETE', {}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when automation not found', async () => {
    mockAuth()
    vi.mocked(prisma.marketingAutomation.findFirst).mockResolvedValue(null)

    const res = await automationsDELETE(makeReq('/api/communications/automations', 'DELETE', { id: 'ma-none' }))
    expect(res.status).toBe(404)
  })

  it('deletes automation successfully', async () => {
    mockAuth()
    vi.mocked(prisma.marketingAutomation.findFirst).mockResolvedValue({ id: 'ma1' } as any)
    vi.mocked(prisma.marketingAutomation.delete).mockResolvedValue({} as any)

    const res = await automationsDELETE(makeReq('/api/communications/automations', 'DELETE', { id: 'ma1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
