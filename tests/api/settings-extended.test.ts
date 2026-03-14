// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

const { mockEncrypt, mockDecrypt } = vi.hoisted(() => ({
  mockEncrypt: vi.fn((val: string) => `enc_${val}`),
  mockDecrypt: vi.fn((val: string) => val.replace('enc_', '')),
}))

vi.mock('@/lib/encryption', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}))

const { mockSmsService, mockEmailService } = vi.hoisted(() => ({
  mockSmsService: {
    initialize: vi.fn(),
    sendSMS: vi.fn(),
  },
  mockEmailService: {
    initialize: vi.fn(),
    sendEmail: vi.fn(),
  },
}))

vi.mock('@/lib/services/sms.service', () => ({
  smsService: mockSmsService,
}))

vi.mock('@/lib/services/email.service', () => ({
  emailService: mockEmailService,
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  GET as gatewayGET,
  PUT as gatewayPUT,
} from '@/app/api/settings/billing/gateway/route'
import {
  GET as holidaysGET,
  POST as holidaysPOST,
  DELETE as holidaysDELETE,
} from '@/app/api/settings/holidays/route'
import {
  GET as proceduresGET,
  POST as proceduresPOST,
} from '@/app/api/settings/procedures/route'
import {
  GET as procedureDetailGET,
  PUT as procedureDetailPUT,
  DELETE as procedureDetailDELETE,
} from '@/app/api/settings/procedures/[id]/route'
import { POST as commTestPOST } from '@/app/api/settings/communications/test/route'
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
// 1. GET /api/settings/billing/gateway
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/settings/billing/gateway', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await gatewayGET()
    expect(res.status).toBe(401)
  })

  it('returns null config when no gateway configured', async () => {
    mockAuth()
    vi.mocked(prisma.paymentGatewayConfig.findUnique).mockResolvedValue(null)
    const res = await gatewayGET()
    const body = await res.json()
    expect(body.config).toBeNull()
  })

  it('returns config with masked secrets for Razorpay', async () => {
    mockAuth()
    vi.mocked(prisma.paymentGatewayConfig.findUnique).mockResolvedValue({
      provider: 'RAZORPAY',
      isEnabled: true,
      isLiveMode: false,
      razorpayKeyId: 'rzp_test_abc123',
      razorpayKeySecret: 'enc_secret_key_xyz',
      phonepeMerchantId: null,
      phonepeSaltKey: null,
      phonepeSaltIndex: null,
      paytmMid: null,
      paytmMerchantKey: null,
      paytmWebsite: null,
    } as any)

    const res = await gatewayGET()
    const body = await res.json()

    expect(body.config.provider).toBe('RAZORPAY')
    expect(body.config.isEnabled).toBe(true)
    expect(body.config.razorpayKeySecret).toMatch(/^\*\*\*\*/)
    expect(body.config.webhookUrl).toContain('/api/webhooks/payment/razorpay')
  })

  it('masks PhonePe salt key', async () => {
    mockAuth()
    vi.mocked(prisma.paymentGatewayConfig.findUnique).mockResolvedValue({
      provider: 'PHONEPE',
      isEnabled: true,
      isLiveMode: true,
      razorpayKeyId: null,
      razorpayKeySecret: null,
      phonepeMerchantId: 'MERCHANT123',
      phonepeSaltKey: 'enc_salt_key_12345',
      phonepeSaltIndex: '1',
      paytmMid: null,
      paytmMerchantKey: null,
      paytmWebsite: null,
    } as any)

    const res = await gatewayGET()
    const body = await res.json()

    expect(body.config.provider).toBe('PHONEPE')
    expect(body.config.phonepeSaltKey).toMatch(/^\*\*\*\*/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. PUT /api/settings/billing/gateway
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/settings/billing/gateway', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await gatewayPUT(makeReq('/api/settings/billing/gateway', 'PUT', { provider: 'RAZORPAY' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid provider', async () => {
    mockAuth()
    const res = await gatewayPUT(makeReq('/api/settings/billing/gateway', 'PUT', { provider: 'STRIPE' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('provider')
  })

  it('creates Razorpay config with encrypted secret', async () => {
    mockAuth()
    vi.mocked(prisma.paymentGatewayConfig.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.paymentGatewayConfig.upsert).mockResolvedValue({
      provider: 'RAZORPAY',
      isEnabled: true,
      isLiveMode: false,
    } as any)

    const res = await gatewayPUT(makeReq('/api/settings/billing/gateway', 'PUT', {
      provider: 'RAZORPAY',
      isEnabled: true,
      razorpayKeyId: 'rzp_test_123',
      razorpayKeySecret: 'my_secret_key',
    }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(mockEncrypt).toHaveBeenCalledWith('my_secret_key')
    expect(prisma.paymentGatewayConfig.upsert).toHaveBeenCalled()
  })

  it('preserves existing secret when masked value sent', async () => {
    mockAuth()
    vi.mocked(prisma.paymentGatewayConfig.findUnique).mockResolvedValue({
      provider: 'RAZORPAY',
      razorpayKeySecret: 'enc_old_secret',
    } as any)
    vi.mocked(prisma.paymentGatewayConfig.upsert).mockResolvedValue({
      provider: 'RAZORPAY',
      isEnabled: true,
      isLiveMode: false,
    } as any)

    const res = await gatewayPUT(makeReq('/api/settings/billing/gateway', 'PUT', {
      provider: 'RAZORPAY',
      isEnabled: true,
      razorpayKeyId: 'rzp_test_123',
      razorpayKeySecret: '****cret',
    }))

    expect(mockEncrypt).not.toHaveBeenCalled()
    const upsertCall = vi.mocked(prisma.paymentGatewayConfig.upsert).mock.calls[0][0] as any
    expect(upsertCall.update.razorpayKeySecret).toBe('enc_old_secret')
  })

  it('clears other provider fields when switching provider', async () => {
    mockAuth()
    vi.mocked(prisma.paymentGatewayConfig.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.paymentGatewayConfig.upsert).mockResolvedValue({
      provider: 'PAYTM',
      isEnabled: true,
      isLiveMode: false,
    } as any)

    await gatewayPUT(makeReq('/api/settings/billing/gateway', 'PUT', {
      provider: 'PAYTM',
      paytmMid: 'MID123',
      paytmMerchantKey: 'key123',
      paytmWebsite: 'WEBSTAGING',
    }))

    const upsertCall = vi.mocked(prisma.paymentGatewayConfig.upsert).mock.calls[0][0] as any
    expect(upsertCall.update.razorpayKeyId).toBeNull()
    expect(upsertCall.update.razorpayKeySecret).toBeNull()
    expect(upsertCall.update.phonepeMerchantId).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/settings/holidays
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/settings/holidays', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await holidaysGET(makeReq('/api/settings/holidays'))
    expect(res.status).toBe(401)
  })

  it('returns all holidays', async () => {
    mockAuth()
    const mockHolidays = [
      { id: 'h1', name: 'Republic Day', date: new Date('2026-01-26'), isRecurring: true },
      { id: 'h2', name: 'Diwali', date: new Date('2026-10-20'), isRecurring: false },
    ]
    vi.mocked(prisma.holiday.findMany).mockResolvedValue(mockHolidays as any)

    const res = await holidaysGET(makeReq('/api/settings/holidays'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.count).toBe(2)
  })

  it('filters holidays by year', async () => {
    mockAuth()
    vi.mocked(prisma.holiday.findMany).mockResolvedValue([])

    await holidaysGET(makeReq('/api/settings/holidays?year=2026'))

    const whereArg = vi.mocked(prisma.holiday.findMany).mock.calls[0][0]?.where
    expect(whereArg.date).toBeDefined()
    expect(whereArg.date.gte).toBeDefined()
    expect(whereArg.date.lte).toBeDefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. POST /api/settings/holidays
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/settings/holidays', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await holidaysPOST(makeReq('/api/settings/holidays', 'POST', {
      name: 'Test', date: '2026-01-01T00:00:00.000Z',
    }))
    expect(res.status).toBe(401)
  })

  it('creates a holiday', async () => {
    mockAuth()
    const mockHoliday = { id: 'h1', name: 'Republic Day', date: new Date('2026-01-26'), isRecurring: true }
    vi.mocked(prisma.holiday.create).mockResolvedValue(mockHoliday as any)

    const res = await holidaysPOST(makeReq('/api/settings/holidays', 'POST', {
      name: 'Republic Day',
      date: '2026-01-26T00:00:00.000Z',
      isRecurring: true,
    }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Republic Day')
  })

  it('returns 500 for invalid data (zod validation)', async () => {
    mockAuth()
    const res = await holidaysPOST(makeReq('/api/settings/holidays', 'POST', {
      name: '',
      date: 'not-a-date',
    }))
    expect(res.status).toBe(500)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. DELETE /api/settings/holidays
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/settings/holidays', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when id is missing', async () => {
    mockAuth()
    const res = await holidaysDELETE(makeReq('/api/settings/holidays', 'DELETE'))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('ID')
  })

  it('deletes a holiday', async () => {
    mockAuth()
    vi.mocked(prisma.holiday.delete).mockResolvedValue({} as any)

    const res = await holidaysDELETE(makeReq('/api/settings/holidays?id=h1', 'DELETE'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(prisma.holiday.delete).toHaveBeenCalledWith({
      where: { id: 'h1', hospitalId: 'h1' },
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. GET /api/settings/procedures
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/settings/procedures', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await proceduresGET(makeReq('/api/settings/procedures'))
    expect(res.status).toBe(401)
  })

  it('returns procedures with pagination', async () => {
    mockAuth()
    const mockProcs = [
      { id: 'p1', code: 'D0100', name: 'Cleaning', category: 'PREVENTIVE', basePrice: 500 },
    ]
    vi.mocked(prisma.procedure.findMany).mockResolvedValue(mockProcs as any)
    vi.mocked(prisma.procedure.count).mockResolvedValue(1)

    const res = await proceduresGET(makeReq('/api/settings/procedures'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('filters by category', async () => {
    mockAuth()
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([])
    vi.mocked(prisma.procedure.count).mockResolvedValue(0)

    await proceduresGET(makeReq('/api/settings/procedures?category=ENDODONTIC'))

    const whereArg = vi.mocked(prisma.procedure.findMany).mock.calls[0][0]?.where
    expect(whereArg.category).toBe('ENDODONTIC')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. POST /api/settings/procedures
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/settings/procedures', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a procedure', async () => {
    mockAuth()
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.procedure.create).mockResolvedValue({
      id: 'p1', code: 'D0100', name: 'Cleaning', category: 'PREVENTIVE', basePrice: 500,
    } as any)

    const res = await proceduresPOST(makeReq('/api/settings/procedures', 'POST', {
      code: 'D0100',
      name: 'Cleaning',
      category: 'PREVENTIVE',
      basePrice: 500,
    }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.code).toBe('D0100')
  })

  it('rejects duplicate procedure code', async () => {
    mockAuth()
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'existing' } as any)

    const res = await proceduresPOST(makeReq('/api/settings/procedures', 'POST', {
      code: 'D0100',
      name: 'Cleaning',
      category: 'PREVENTIVE',
      basePrice: 500,
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('already exists')
  })

  it('returns 500 for invalid category', async () => {
    mockAuth()
    const res = await proceduresPOST(makeReq('/api/settings/procedures', 'POST', {
      code: 'D0100',
      name: 'Cleaning',
      category: 'INVALID',
      basePrice: 500,
    }))
    expect(res.status).toBe(500)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8. GET /api/settings/procedures/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/settings/procedures/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when procedure not found', async () => {
    mockAuth()
    vi.mocked(prisma.procedure.findUnique).mockResolvedValue(null)
    const res = await procedureDetailGET(makeReq('/api/settings/procedures/p1'), makeParams('p1') as any)
    const body = await res.json()
    expect(res.status).toBe(404)
  })

  it('returns procedure detail', async () => {
    mockAuth()
    vi.mocked(prisma.procedure.findUnique).mockResolvedValue({
      id: 'p1', code: 'D0100', name: 'Cleaning', category: 'PREVENTIVE', basePrice: 500,
    } as any)

    const res = await procedureDetailGET(makeReq('/api/settings/procedures/p1'), makeParams('p1') as any)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.id).toBe('p1')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9. PUT /api/settings/procedures/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/settings/procedures/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when procedure not found', async () => {
    mockAuth()
    vi.mocked(prisma.procedure.findUnique).mockResolvedValue(null)
    const res = await procedureDetailPUT(
      makeReq('/api/settings/procedures/p1', 'PUT', { name: 'Updated' }),
      makeParams('p1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('updates a procedure', async () => {
    mockAuth()
    vi.mocked(prisma.procedure.findUnique).mockResolvedValue({
      id: 'p1', code: 'D0100', name: 'Cleaning',
    } as any)
    vi.mocked(prisma.procedure.update).mockResolvedValue({
      id: 'p1', code: 'D0100', name: 'Deep Cleaning', basePrice: 800,
    } as any)

    const res = await procedureDetailPUT(
      makeReq('/api/settings/procedures/p1', 'PUT', { name: 'Deep Cleaning', basePrice: 800 }),
      makeParams('p1') as any,
    )
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Deep Cleaning')
  })

  it('rejects duplicate code on code change', async () => {
    mockAuth()
    vi.mocked(prisma.procedure.findUnique).mockResolvedValue({
      id: 'p1', code: 'D0100', name: 'Cleaning',
    } as any)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'p2' } as any)

    const res = await procedureDetailPUT(
      makeReq('/api/settings/procedures/p1', 'PUT', { code: 'D0200' }),
      makeParams('p1') as any,
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('already exists')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10. DELETE /api/settings/procedures/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/settings/procedures/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when procedure not found', async () => {
    mockAuth()
    vi.mocked(prisma.procedure.findUnique).mockResolvedValue(null)
    const res = await procedureDetailDELETE(
      makeReq('/api/settings/procedures/p1', 'DELETE'),
      makeParams('p1') as any,
    )
    expect(res.status).toBe(404)
  })

  it('soft deletes (deactivates) a procedure', async () => {
    mockAuth()
    vi.mocked(prisma.procedure.findUnique).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.procedure.update).mockResolvedValue({
      id: 'p1', isActive: false,
    } as any)

    const res = await procedureDetailDELETE(
      makeReq('/api/settings/procedures/p1', 'DELETE'),
      makeParams('p1') as any,
    )
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(prisma.procedure.update).toHaveBeenCalledWith({
      where: { id: 'p1', hospitalId: 'h1' },
      data: { isActive: false },
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 11. POST /api/settings/communications/test
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/settings/communications/test', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await commTestPOST(makeReq('/api/settings/communications/test', 'POST', { type: 'sms' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when type is missing', async () => {
    mockAuth()
    const res = await commTestPOST(makeReq('/api/settings/communications/test', 'POST', {}))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('Type is required')
  })

  it('returns 400 for invalid type', async () => {
    mockAuth()
    const res = await commTestPOST(makeReq('/api/settings/communications/test', 'POST', { type: 'whatsapp' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain("'sms' or 'email'")
  })

  it('returns 400 when phone is missing for SMS test', async () => {
    mockAuth()
    const res = await commTestPOST(makeReq('/api/settings/communications/test', 'POST', {
      type: 'sms', testData: {},
    }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('Phone number')
  })

  it('sends test SMS successfully', async () => {
    mockAuth()
    mockSmsService.initialize.mockResolvedValue(undefined)
    mockSmsService.sendSMS.mockResolvedValue(undefined)

    const res = await commTestPOST(makeReq('/api/settings/communications/test', 'POST', {
      type: 'sms', testData: { phone: '9876543210' },
    }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.message).toContain('SMS sent')
    expect(mockSmsService.sendSMS).toHaveBeenCalled()
  })

  it('returns 400 when SMS send fails', async () => {
    mockAuth()
    mockSmsService.initialize.mockResolvedValue(undefined)
    mockSmsService.sendSMS.mockRejectedValue(new Error('SMS gateway unreachable'))

    const res = await commTestPOST(makeReq('/api/settings/communications/test', 'POST', {
      type: 'sms', testData: { phone: '9876543210' },
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
  })

  it('returns 400 when email address is missing for email test', async () => {
    mockAuth()
    const res = await commTestPOST(makeReq('/api/settings/communications/test', 'POST', {
      type: 'email', testData: {},
    }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('Email address')
  })

  it('sends test email successfully', async () => {
    mockAuth()
    mockEmailService.initialize.mockResolvedValue(undefined)
    mockEmailService.sendEmail.mockResolvedValue(undefined)

    const res = await commTestPOST(makeReq('/api/settings/communications/test', 'POST', {
      type: 'email', testData: { email: 'test@example.com' },
    }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.message).toContain('email sent')
    expect(mockEmailService.sendEmail).toHaveBeenCalled()
  })

  it('returns 400 when email send fails', async () => {
    mockAuth()
    mockEmailService.initialize.mockResolvedValue(undefined)
    mockEmailService.sendEmail.mockRejectedValue(new Error('SMTP error'))

    const res = await commTestPOST(makeReq('/api/settings/communications/test', 'POST', {
      type: 'email', testData: { email: 'test@example.com' },
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
  })
})
