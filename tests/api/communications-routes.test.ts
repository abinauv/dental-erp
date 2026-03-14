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

vi.mock('@/lib/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn(),
    getSMSHistory: vi.fn(),
  },
}))

vi.mock('@/lib/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn(),
    sendWithTemplate: vi.fn(),
    getEmailHistory: vi.fn(),
  },
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
  POST as templatesPOST,
  GET as templatesGET,
} from '@/app/api/communications/templates/route'
import {
  POST as smsPOST,
  GET as smsGET,
} from '@/app/api/communications/sms/route'
import {
  POST as emailPOST,
  GET as emailGET,
} from '@/app/api/communications/email/route'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { templateService } from '@/lib/services/template.service'
import { smsService } from '@/lib/services/sms.service'
import { emailService } from '@/lib/services/email.service'

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
// 1. POST /api/communications/templates
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/communications/templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await templatesPOST(makeReq('/api/communications/templates', 'POST', {
      name: 'T', category: 'GENERAL', channel: 'SMS', content: 'Hi',
    }))
    expect(res.status).toBe(401)
  })

  it('creates template when validation passes', async () => {
    mockAuth()
    vi.mocked(templateService.validateTemplate).mockReturnValue({
      isValid: true,
      errors: [],
      unknownVariables: [],
    })
    vi.mocked(templateService.createTemplate).mockResolvedValue({
      id: 't1',
      name: 'Reminder',
      category: 'APPOINTMENT',
      channel: 'SMS',
      content: 'Hello {{patientName}}',
    } as any)

    const res = await templatesPOST(makeReq('/api/communications/templates', 'POST', {
      name: 'Reminder',
      category: 'APPOINTMENT',
      channel: 'SMS',
      content: 'Hello {{patientName}}',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.id).toBe('t1')
    expect(templateService.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ hospitalId: 'h1', name: 'Reminder' })
    )
  })

  it('returns 400 when template validation fails', async () => {
    mockAuth()
    vi.mocked(templateService.validateTemplate).mockReturnValue({
      isValid: false,
      errors: ['Unknown variable {{badVar}}'],
      unknownVariables: ['badVar'],
    })

    const res = await templatesPOST(makeReq('/api/communications/templates', 'POST', {
      name: 'Bad', category: 'GENERAL', channel: 'SMS', content: 'Hello {{badVar}}',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Template validation failed')
    expect(body.unknownVariables).toContain('badVar')
  })

  it('returns 500 for invalid category enum', async () => {
    mockAuth()
    const res = await templatesPOST(makeReq('/api/communications/templates', 'POST', {
      name: 'T', category: 'INVALID_CAT', channel: 'SMS', content: 'Hi',
    }))
    expect(res.status).toBe(500)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET /api/communications/templates
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/communications/templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await templatesGET(makeReq('/api/communications/templates'))
    expect(res.status).toBe(401)
  })

  it('returns templates with count', async () => {
    mockAuth()
    const mockTemplates = [
      { id: 't1', name: 'Reminder', category: 'APPOINTMENT' },
      { id: 't2', name: 'Payment', category: 'PAYMENT' },
    ]
    vi.mocked(templateService.getTemplates).mockResolvedValue(mockTemplates as any)

    const res = await templatesGET(makeReq('/api/communications/templates'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.count).toBe(2)
  })

  it('passes filters to service', async () => {
    mockAuth()
    vi.mocked(templateService.getTemplates).mockResolvedValue([])

    await templatesGET(makeReq('/api/communications/templates?category=PAYMENT&channel=EMAIL&isActive=true'))

    expect(templateService.getTemplates).toHaveBeenCalledWith('h1', {
      category: 'PAYMENT',
      channel: 'EMAIL',
      isActive: true,
    })
  })

  it('returns empty array when no templates exist', async () => {
    mockAuth()
    vi.mocked(templateService.getTemplates).mockResolvedValue([])

    const res = await templatesGET(makeReq('/api/communications/templates'))
    const body = await res.json()

    expect(body.data).toEqual([])
    expect(body.count).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. POST /api/communications/sms
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/communications/sms', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await smsPOST(makeReq('/api/communications/sms', 'POST', {
      phone: '9876543210', message: 'Hello',
    }))
    expect(res.status).toBe(401)
  })

  it('sends SMS successfully', async () => {
    mockAuth()
    vi.mocked(smsService.sendSMS).mockResolvedValue('sms1' as any)

    const res = await smsPOST(makeReq('/api/communications/sms', 'POST', {
      phone: '9876543210',
      message: 'Test message',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.smsLogId).toBe('sms1')
  })

  it('returns 500 for validation error (phone too short)', async () => {
    mockAuth()
    const res = await smsPOST(makeReq('/api/communications/sms', 'POST', {
      phone: '123',
      message: 'Hello',
    }))
    expect(res.status).toBe(500)
  })

  it('returns 500 for validation error (message too long)', async () => {
    mockAuth()
    const res = await smsPOST(makeReq('/api/communications/sms', 'POST', {
      phone: '9876543210',
      message: 'x'.repeat(501),
    }))
    expect(res.status).toBe(500)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. GET /api/communications/sms
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/communications/sms', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await smsGET(makeReq('/api/communications/sms'))
    expect(res.status).toBe(401)
  })

  it('returns SMS history', async () => {
    mockAuth()
    const mockHistory = [
      { id: 'sms1', phone: '9876543210', status: 'DELIVERED' },
    ]
    vi.mocked(smsService.getSMSHistory).mockResolvedValue(mockHistory as any)

    const res = await smsGET(makeReq('/api/communications/sms'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
  })

  it('passes filters to service', async () => {
    mockAuth()
    vi.mocked(smsService.getSMSHistory).mockResolvedValue([])

    await smsGET(makeReq('/api/communications/sms?status=DELIVERED&phone=9876543210&limit=50'))

    expect(smsService.getSMSHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        hospitalId: 'h1',
        status: 'DELIVERED',
        phone: '9876543210',
        limit: 50,
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. POST /api/communications/email
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/communications/email', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await emailPOST(makeReq('/api/communications/email', 'POST', {
      to: 'test@example.com', subject: 'Hi', body: 'Hello',
    }))
    expect(res.status).toBe(401)
  })

  it('sends email successfully', async () => {
    mockAuth()
    vi.mocked(emailService.sendEmail).mockResolvedValue('em1' as any)

    const res = await emailPOST(makeReq('/api/communications/email', 'POST', {
      to: 'patient@example.com',
      subject: 'Appointment Reminder',
      body: 'Your appointment is tomorrow.',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailLogId).toBe('em1')
  })

  it('sends email with template', async () => {
    mockAuth()
    vi.mocked(emailService.sendWithTemplate).mockResolvedValue('em2' as any)

    const res = await emailPOST(makeReq('/api/communications/email', 'POST', {
      to: 'patient@example.com',
      templateId: 't1',
      variables: { patientName: 'John' },
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. GET /api/communications/email
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/communications/email', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await emailGET(makeReq('/api/communications/email'))
    expect(res.status).toBe(401)
  })

  it('returns email history', async () => {
    mockAuth()
    const mockHistory = [
      { id: 'em1', to: 'test@example.com', status: 'SENT' },
    ]
    vi.mocked(emailService.getEmailHistory).mockResolvedValue(mockHistory as any)

    const res = await emailGET(makeReq('/api/communications/email'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
  })

  it('passes filters to service', async () => {
    mockAuth()
    vi.mocked(emailService.getEmailHistory).mockResolvedValue([])

    await emailGET(makeReq('/api/communications/email?status=SENT&email=test@example.com&limit=25'))

    expect(emailService.getEmailHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        hospitalId: 'h1',
        status: 'SENT',
        email: 'test@example.com',
        limit: 25,
      })
    )
  })
})
