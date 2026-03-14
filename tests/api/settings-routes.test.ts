// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/services/template.service', () => ({
  templateService: {
    validateTemplate: vi.fn(),
    createTemplate: vi.fn(),
    getTemplates: vi.fn(),
  },
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
  GET as settingsGET,
  POST as settingsPOST,
  PUT as settingsPUT,
} from '@/app/api/settings/route'
import {
  GET as clinicGET,
  POST as clinicPOST,
} from '@/app/api/settings/clinic/route'
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
// 1. GET /api/settings
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await settingsGET(makeReq('/api/settings'))
    expect(res.status).toBe(401)
  })

  it('returns all settings grouped by category', async () => {
    mockAuth()
    const mockSettings = [
      { id: 's1', key: 'email.host', value: 'smtp.example.com', category: 'email' },
      { id: 's2', key: 'email.port', value: '587', category: 'email' },
      { id: 's3', key: 'sms.provider', value: 'msg91', category: 'sms' },
    ]
    vi.mocked(prisma.setting.findMany).mockResolvedValue(mockSettings as any)

    const res = await settingsGET(makeReq('/api/settings'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(3)
    expect(body.grouped.email).toHaveLength(2)
    expect(body.grouped.sms).toHaveLength(1)
  })

  it('filters by category when provided', async () => {
    mockAuth()
    vi.mocked(prisma.setting.findMany).mockResolvedValue([])

    await settingsGET(makeReq('/api/settings?category=email'))

    expect(prisma.setting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hospitalId: 'h1', category: 'email' },
      })
    )
  })

  it('returns empty grouped object when no settings', async () => {
    mockAuth()
    vi.mocked(prisma.setting.findMany).mockResolvedValue([])

    const res = await settingsGET(makeReq('/api/settings'))
    const body = await res.json()

    expect(body.data).toEqual([])
    expect(body.grouped).toEqual({})
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/settings
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await settingsPOST(makeReq('/api/settings', 'POST', { key: 'k', value: 'v' }))
    expect(res.status).toBe(401)
  })

  it('upserts a setting successfully', async () => {
    mockAuth()
    const mockSetting = { id: 's1', key: 'test.key', value: 'test-value', category: 'general' }
    vi.mocked(prisma.setting.upsert).mockResolvedValue(mockSetting as any)

    const res = await settingsPOST(makeReq('/api/settings', 'POST', {
      key: 'test.key',
      value: 'test-value',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.key).toBe('test.key')
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hospitalId_key: { key: 'test.key', hospitalId: 'h1' } },
      })
    )
  })

  it('uses default category "general" when none provided', async () => {
    mockAuth()
    vi.mocked(prisma.setting.upsert).mockResolvedValue({ id: 's1' } as any)

    await settingsPOST(makeReq('/api/settings', 'POST', {
      key: 'my.key',
      value: 'v',
    }))

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ category: 'general' }),
      })
    )
  })

  it('returns 500 for invalid schema (missing key)', async () => {
    mockAuth()
    const res = await settingsPOST(makeReq('/api/settings', 'POST', { value: 'only-value' }))
    expect(res.status).toBe(500) // Zod error caught in catch block
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. PUT /api/settings (Bulk update)
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await settingsPUT(makeReq('/api/settings', 'PUT', { settings: [] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when settings is not an array', async () => {
    mockAuth()
    const res = await settingsPUT(makeReq('/api/settings', 'PUT', { settings: 'not-array' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Settings must be an array')
  })

  it('bulk upserts multiple settings', async () => {
    mockAuth()
    vi.mocked(prisma.setting.upsert)
      .mockResolvedValueOnce({ id: 's1', key: 'a' } as any)
      .mockResolvedValueOnce({ id: 's2', key: 'b' } as any)

    const res = await settingsPUT(makeReq('/api/settings', 'PUT', {
      settings: [
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
      ],
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.count).toBe(2)
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(2)
  })

  it('handles empty settings array', async () => {
    mockAuth()

    const res = await settingsPUT(makeReq('/api/settings', 'PUT', { settings: [] }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.count).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. GET /api/settings/clinic
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/settings/clinic', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await clinicGET(makeReq('/api/settings/clinic'))
    expect(res.status).toBe(401)
  })

  it('returns clinic information', async () => {
    mockAuth()
    const mockClinic = {
      id: 'h1',
      name: 'Test Dental Clinic',
      phone: '9876543210',
      address: '123 Main St',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      slug: 'test-dental',
    }
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue(mockClinic as any)

    const res = await clinicGET(makeReq('/api/settings/clinic'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Test Dental Clinic')
  })

  it('returns null data when hospital not found', async () => {
    mockAuth()
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue(null)

    const res = await clinicGET(makeReq('/api/settings/clinic'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. POST /api/settings/clinic
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/settings/clinic', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await clinicPOST(makeReq('/api/settings/clinic', 'POST', {}))
    expect(res.status).toBe(401)
  })

  it('updates clinic info with valid data', async () => {
    mockAuth()
    const clinicData = {
      name: 'Updated Clinic',
      phone: '9876543210',
      address: '456 New Rd',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    }
    vi.mocked(prisma.hospital.update).mockResolvedValue({ id: 'h1', ...clinicData } as any)

    const res = await clinicPOST(makeReq('/api/settings/clinic', 'POST', clinicData))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toBe('Clinic information saved successfully')
    expect(prisma.hospital.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: expect.objectContaining({ name: 'Updated Clinic' }),
    })
  })

  it('returns 500 for validation error (missing name)', async () => {
    mockAuth()
    const res = await clinicPOST(makeReq('/api/settings/clinic', 'POST', {
      phone: '9876543210',
      address: '456 New Rd',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    }))
    // Zod validation error goes to catch block → 500
    expect(res.status).toBe(500)
  })

  it('converts empty optional strings to undefined', async () => {
    mockAuth()
    vi.mocked(prisma.hospital.update).mockResolvedValue({ id: 'h1' } as any)

    await clinicPOST(makeReq('/api/settings/clinic', 'POST', {
      name: 'Clinic',
      phone: '9876543210',
      address: 'Addr',
      city: 'City',
      state: 'State',
      pincode: '110001',
      tagline: '',
      website: '',
    }))

    expect(prisma.hospital.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: expect.objectContaining({
        tagline: undefined,
        website: undefined,
      }),
    })
  })
})
