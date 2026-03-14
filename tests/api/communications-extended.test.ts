// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

const { mockTemplateService } = vi.hoisted(() => ({
  mockTemplateService: {
    getTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    validateTemplate: vi.fn(),
  },
}))
vi.mock('@/lib/services/template.service', () => ({
  templateService: mockTemplateService,
}))

const { mockSmsService } = vi.hoisted(() => ({
  mockSmsService: {
    sendBulkSMS: vi.fn(),
  },
}))
vi.mock('@/lib/services/sms.service', () => ({
  smsService: mockSmsService,
}))

const { mockTriggersService } = vi.hoisted(() => ({
  mockTriggersService: {
    runAllTriggers: vi.fn(),
  },
}))
vi.mock('@/lib/services/communication-triggers.service', () => ({
  communicationTriggersService: mockTriggersService,
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  GET as templateDetailGET,
  PUT as templateDetailPUT,
  DELETE as templateDetailDELETE,
} from '@/app/api/communications/templates/[id]/route'
import { POST as bulkSMSPOST } from '@/app/api/communications/sms/bulk/route'
import {
  GET as surveysGET,
  POST as surveysPOST,
} from '@/app/api/communications/surveys/route'
import {
  POST as triggersPOST,
  GET as triggersGET,
} from '@/app/api/communications/triggers/route'
import { GET as feedbackAnalyticsGET } from '@/app/api/communications/feedback/analytics/route'
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

function makeReq(path: string, method = 'GET', body?: any, headers?: Record<string, string>): NextRequest {
  const url = `http://localhost${path}`
  const init: any = { method, headers: { ...headers } }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers['Content-Type'] = 'application/json'
  }
  return new NextRequest(url, init)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/communications/templates/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/communications/templates/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await templateDetailGET(makeReq('/api/communications/templates/t1'), makeParams('t1') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when template not found', async () => {
    mockAuth()
    mockTemplateService.getTemplate.mockResolvedValue(null)
    const res = await templateDetailGET(makeReq('/api/communications/templates/t1'), makeParams('t1') as any)
    expect(res.status).toBe(404)
  })

  it('returns template detail', async () => {
    mockAuth()
    mockTemplateService.getTemplate.mockResolvedValue({
      id: 't1', name: 'Appointment Reminder', content: 'Hello {{patient_name}}',
    })
    const res = await templateDetailGET(makeReq('/api/communications/templates/t1'), makeParams('t1') as any)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Appointment Reminder')
    expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('t1', 'h1')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. PUT /api/communications/templates/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/communications/templates/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await templateDetailPUT(
      makeReq('/api/communications/templates/t1', 'PUT', { name: 'X' }),
      makeParams('t1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 for non-ADMIN/DOCTOR roles', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'STAFF' } } })
    const res = await templateDetailPUT(
      makeReq('/api/communications/templates/t1', 'PUT', { name: 'X' }),
      makeParams('t1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('validates template content before update', async () => {
    mockAuth()
    mockTemplateService.validateTemplate.mockReturnValue({
      isValid: false,
      errors: ['Invalid variable'],
      unknownVariables: ['{{bad_var}}'],
    })
    const res = await templateDetailPUT(
      makeReq('/api/communications/templates/t1', 'PUT', { content: 'Hello {{bad_var}}' }),
      makeParams('t1') as any,
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('validation')
  })

  it('updates template successfully', async () => {
    mockAuth()
    mockTemplateService.validateTemplate.mockReturnValue({ isValid: true, errors: [], unknownVariables: [] })
    mockTemplateService.updateTemplate.mockResolvedValue({
      id: 't1', name: 'Updated Template', content: 'Hello {{patient_name}}',
    })

    const res = await templateDetailPUT(
      makeReq('/api/communications/templates/t1', 'PUT', {
        name: 'Updated Template',
        content: 'Hello {{patient_name}}',
      }),
      makeParams('t1') as any,
    )
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.name).toBe('Updated Template')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. DELETE /api/communications/templates/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/communications/templates/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await templateDetailDELETE(
      makeReq('/api/communications/templates/t1', 'DELETE'),
      makeParams('t1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 for non-ADMIN roles', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'DOCTOR' } } })
    const res = await templateDetailDELETE(
      makeReq('/api/communications/templates/t1', 'DELETE'),
      makeParams('t1') as any,
    )
    expect(res.status).toBe(401)
  })

  it('deletes template successfully', async () => {
    mockAuth()
    mockTemplateService.deleteTemplate.mockResolvedValue(undefined)
    const res = await templateDetailDELETE(
      makeReq('/api/communications/templates/t1', 'DELETE'),
      makeParams('t1') as any,
    )
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(mockTemplateService.deleteTemplate).toHaveBeenCalledWith('t1', 'h1')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. POST /api/communications/sms/bulk
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/communications/sms/bulk', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await bulkSMSPOST(makeReq('/api/communications/sms/bulk', 'POST', {
      recipients: [{ phone: '9876543210', message: 'Test' }],
    }))
    expect(res.status).toBe(401)
  })

  it('sends bulk SMS and returns counts', async () => {
    mockAuth()
    mockSmsService.sendBulkSMS.mockResolvedValue([true, true, false])

    const res = await bulkSMSPOST(makeReq('/api/communications/sms/bulk', 'POST', {
      recipients: [
        { phone: '9876543210', message: 'Hello 1' },
        { phone: '9876543211', message: 'Hello 2' },
        { phone: '9876543212', message: 'Hello 3' },
      ],
    }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.totalRecipients).toBe(3)
    expect(body.successCount).toBe(2)
    expect(body.failedCount).toBe(1)
  })

  it('validates recipients with zod', async () => {
    mockAuth()
    const res = await bulkSMSPOST(makeReq('/api/communications/sms/bulk', 'POST', {
      recipients: [], // min 1
    }))
    expect(res.status).toBe(500) // zod parse error caught in try/catch
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. GET/POST /api/communications/surveys
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/communications/surveys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await surveysGET(makeReq('/api/communications/surveys'))
    expect(res.status).toBe(401)
  })

  it('returns surveys list with response counts', async () => {
    mockAuth()
    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      {
        id: 'sv1', title: 'Patient Satisfaction', surveyType: 'SATISFACTION',
        questions: JSON.stringify([{ question: 'How was your visit?', type: 'rating' }]),
        _count: { responses: 42 },
      },
    ] as any)

    const res = await surveysGET(makeReq('/api/communications/surveys'))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].questions).toHaveLength(1) // parsed from JSON
    expect(body.count).toBe(1)
  })

  it('filters by surveyType', async () => {
    mockAuth()
    vi.mocked(prisma.survey.findMany).mockResolvedValue([] as any)

    await surveysGET(makeReq('/api/communications/surveys?surveyType=NPS'))
    const call = vi.mocked(prisma.survey.findMany).mock.calls[0][0]
    expect(call.where.surveyType).toBe('NPS')
  })

  it('filters by isActive', async () => {
    mockAuth()
    vi.mocked(prisma.survey.findMany).mockResolvedValue([] as any)

    await surveysGET(makeReq('/api/communications/surveys?isActive=true'))
    const call = vi.mocked(prisma.survey.findMany).mock.calls[0][0]
    expect(call.where.isActive).toBe(true)
  })
})

describe('POST /api/communications/surveys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await surveysPOST(makeReq('/api/communications/surveys', 'POST', {
      title: 'Test', surveyType: 'NPS', questions: [],
    }))
    expect(res.status).toBe(401)
  })

  it('returns 401 for non-ADMIN/DOCTOR roles', async () => {
    mockAuth({ session: { user: { id: 'u1', role: 'STAFF' } } })
    const res = await surveysPOST(makeReq('/api/communications/surveys', 'POST', {
      title: 'Test', surveyType: 'NPS', questions: [{ question: 'Q1', type: 'rating' }],
    }))
    expect(res.status).toBe(401)
  })

  it('creates survey with questions', async () => {
    mockAuth()
    vi.mocked(prisma.survey.create).mockResolvedValue({
      id: 'sv1', title: 'NPS Survey', surveyType: 'NPS', isActive: true,
    } as any)

    const res = await surveysPOST(makeReq('/api/communications/surveys', 'POST', {
      title: 'NPS Survey',
      surveyType: 'NPS',
      questions: [
        { question: 'How likely are you to recommend us?', type: 'rating', required: true },
      ],
    }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.title).toBe('NPS Survey')
    const createCall = vi.mocked(prisma.survey.create).mock.calls[0][0]
    expect(JSON.parse(createCall.data.questions)).toHaveLength(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. POST/GET /api/communications/triggers
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/communications/triggers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without valid cron secret', async () => {
    const res = await triggersPOST(makeReq('/api/communications/triggers', 'POST', null, {
      authorization: 'Bearer wrong-secret',
    }))
    expect(res.status).toBe(401)
  })

  it('runs triggers with valid cron secret', async () => {
    mockTriggersService.runAllTriggers.mockResolvedValue(undefined)
    const cronSecret = process.env.CRON_SECRET || 'your-cron-secret-key'

    const res = await triggersPOST(makeReq('/api/communications/triggers', 'POST', null, {
      authorization: `Bearer ${cronSecret}`,
    }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(mockTriggersService.runAllTriggers).toHaveBeenCalled()
  })
})

describe('GET /api/communications/triggers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blocks in production', async () => {
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const res = await triggersGET(makeReq('/api/communications/triggers'))
    expect(res.status).toBe(403)
    process.env.NODE_ENV = origEnv
  })

  it('runs triggers in non-production', async () => {
    mockTriggersService.runAllTriggers.mockResolvedValue(undefined)
    const res = await triggersGET(makeReq('/api/communications/triggers'))
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. GET /api/communications/feedback/analytics
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/communications/feedback/analytics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await feedbackAnalyticsGET(makeReq('/api/communications/feedback/analytics'))
    expect(res.status).toBe(401)
  })

  it('returns empty analytics when no surveys exist', async () => {
    mockAuth()
    vi.mocked(prisma.survey.findMany).mockResolvedValue([])

    const res = await feedbackAnalyticsGET(makeReq('/api/communications/feedback/analytics'))
    const body = await res.json()

    expect(body.totalSurveys).toBe(0)
    expect(body.totalResponses).toBe(0)
    expect(body.nps.score).toBe(0)
  })

  it('calculates NPS and sentiment from responses', async () => {
    mockAuth()
    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      { id: 'sv1', title: 'NPS', surveyType: 'NPS' },
    ] as any)

    const now = new Date()
    vi.mocked(prisma.surveyResponse.findMany).mockResolvedValue([
      { id: 'r1', surveyId: 'sv1', rating: 5, sentiment: 'positive', answers: '{}', createdAt: now, isComplete: true },
      { id: 'r2', surveyId: 'sv1', rating: 4, sentiment: 'positive', answers: '{}', createdAt: now, isComplete: true },
      { id: 'r3', surveyId: 'sv1', rating: 2, sentiment: 'negative', answers: '{}', createdAt: now, isComplete: true },
      { id: 'r4', surveyId: 'sv1', rating: 3, sentiment: 'neutral', answers: '{}', createdAt: now, isComplete: true },
    ] as any)

    vi.mocked(prisma.surveyResponse.count).mockResolvedValue(4)

    const res = await feedbackAnalyticsGET(makeReq('/api/communications/feedback/analytics'))
    const body = await res.json()

    expect(body.totalResponses).toBe(4)
    expect(body.avgRating).toBe(3.5)
    // NPS: 2 promoters (4,5), 1 passive (3), 1 detractor (2) => (2-1)/4*100 = 25
    expect(body.nps.score).toBe(25)
    expect(body.nps.promoters).toBe(2)
    expect(body.nps.detractors).toBe(1)
    expect(body.sentimentBreakdown.positive).toBe(2)
    expect(body.sentimentBreakdown.negative).toBe(1)
  })

  it('extracts word frequencies from open-text answers', async () => {
    mockAuth()
    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      { id: 'sv1', title: 'Feedback', surveyType: 'FEEDBACK' },
    ] as any)
    vi.mocked(prisma.surveyResponse.findMany).mockResolvedValue([
      {
        id: 'r1', surveyId: 'sv1', rating: null, sentiment: null,
        answers: JSON.stringify({ q1: 'excellent service very professional', q2: 'excellent staff' }),
        createdAt: new Date(), isComplete: true, patientId: null,
      },
    ] as any)
    vi.mocked(prisma.surveyResponse.count).mockResolvedValue(1)

    const res = await feedbackAnalyticsGET(makeReq('/api/communications/feedback/analytics'))
    const body = await res.json()

    // "excellent" should appear twice
    const excellentWord = body.wordFrequencies.find((w: any) => w.word === 'excellent')
    expect(excellentWord).toBeDefined()
    expect(excellentWord.count).toBe(2)
  })
})
