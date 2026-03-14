// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

const { mockComplete, mockExtractJSON } = vi.hoisted(() => ({
  mockComplete: vi.fn(),
  mockExtractJSON: vi.fn((s) => s),
}))

vi.mock('@/lib/ai/openrouter', () => ({
  complete: mockComplete,
  extractJSON: mockExtractJSON,
}))

vi.mock('@/lib/ai/models', () => ({
  getModelByTier: vi.fn(() => 'mock-model'),
  getModelForSkill: vi.fn(() => 'mock-model'),
}))

vi.mock('@/lib/ai/skills', () => ({
  getSkill: vi.fn((name) => {
    if (name === 'dynamic-pricing') {
      return { systemPrompt: vi.fn(() => 'mock system prompt') }
    }
    return null
  }),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { POST as queryPOST } from '@/app/api/ai/query/route'
import { GET as noShowGET } from '@/app/api/ai/no-show-risk/route'
import { GET as pricingGET } from '@/app/api/ai/pricing-suggestions/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockAuth(overrides = {}) {
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
// 1. POST /api/ai/query
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/ai/query', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await queryPOST(makeReq('/api/ai/query', 'POST', { query: 'test' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when query is missing', async () => {
    mockAuth()
    const res = await queryPOST(makeReq('/api/ai/query', 'POST', {}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('query is required')
  })

  it('returns 400 when query is empty string', async () => {
    mockAuth()
    const res = await queryPOST(makeReq('/api/ai/query', 'POST', { query: '   ' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when AI returns unsupported model', async () => {
    mockAuth()
    mockComplete.mockResolvedValue({ content: '{"model":"unknownModel","filters":{},"limit":10}' })
    mockExtractJSON.mockReturnValue('{"model":"unknownModel","filters":{},"limit":10}')

    const res = await queryPOST(makeReq('/api/ai/query', 'POST', { query: 'show me unknowns' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Unsupported data source')
  })

  it('executes whitelisted patient query successfully', async () => {
    mockAuth()
    const aiResponse = JSON.stringify({ model: 'patient', filters: { name: 'John' }, limit: 5, summary: 'Patients named John' })
    mockComplete.mockResolvedValue({ content: aiResponse })
    mockExtractJSON.mockReturnValue(aiResponse)
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { firstName: 'John', lastName: 'Doe', patientId: 'PAT001', age: 35, phone: '9876543210' },
    ] as any)
    vi.mocked(prisma.aISkillExecution.create).mockResolvedValue({} as any)

    const res = await queryPOST(makeReq('/api/ai/query', 'POST', { query: 'patients named John' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.model).toBe('patient')
    expect(body.rowCount).toBe(1)
    expect(body.rows).toHaveLength(1)
    expect(body.summary).toBe('Patients named John')
  })

  it('executes whitelisted invoice query successfully', async () => {
    mockAuth()
    const aiResponse = JSON.stringify({ model: 'invoice', filters: { status: 'PENDING' }, limit: 10 })
    mockComplete.mockResolvedValue({ content: aiResponse })
    mockExtractJSON.mockReturnValue(aiResponse)
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { id: 'inv1', status: 'PENDING', patient: { firstName: 'A', lastName: 'B' } },
    ] as any)
    vi.mocked(prisma.aISkillExecution.create).mockResolvedValue({} as any)

    const res = await queryPOST(makeReq('/api/ai/query', 'POST', { query: 'pending invoices' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.model).toBe('invoice')
    expect(body.rowCount).toBe(1)
  })

  it('returns 502 when AI service errors with OpenRouter message', async () => {
    mockAuth()
    mockComplete.mockRejectedValue(new Error('OpenRouter API rate limit exceeded'))

    const res = await queryPOST(makeReq('/api/ai/query', 'POST', { query: 'test query' }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toContain('AI service error')
  })

  it('returns 400 when AI response is unparseable', async () => {
    mockAuth()
    mockComplete.mockResolvedValue({ content: 'not json at all' })
    mockExtractJSON.mockReturnValue('not json at all')

    const res = await queryPOST(makeReq('/api/ai/query', 'POST', { query: 'show patients' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Could not parse')
  })

  it('caps limit at 50', async () => {
    mockAuth()
    const aiResponse = JSON.stringify({ model: 'patient', filters: {}, limit: 999 })
    mockComplete.mockResolvedValue({ content: aiResponse })
    mockExtractJSON.mockReturnValue(aiResponse)
    vi.mocked(prisma.patient.findMany).mockResolvedValue([])
    vi.mocked(prisma.aISkillExecution.create).mockResolvedValue({} as any)

    await queryPOST(makeReq('/api/ai/query', 'POST', { query: 'all patients' }))

    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    )
  })

  it('logs execution to aISkillExecution', async () => {
    mockAuth()
    const aiResponse = JSON.stringify({ model: 'patient', filters: {}, limit: 5 })
    mockComplete.mockResolvedValue({ content: aiResponse })
    mockExtractJSON.mockReturnValue(aiResponse)
    vi.mocked(prisma.patient.findMany).mockResolvedValue([])
    vi.mocked(prisma.aISkillExecution.create).mockResolvedValue({} as any)

    await queryPOST(makeReq('/api/ai/query', 'POST', { query: 'test' }))

    expect(prisma.aISkillExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'h1',
          userId: 'u1',
          skill: 'nl_query',
          status: 'COMPLETED',
        }),
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET /api/ai/no-show-risk
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/ai/no-show-risk', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await noShowGET(makeReq('/api/ai/no-show-risk'))
    expect(res.status).toBe(401)
  })

  it('returns empty predictions when no upcoming appointments', async () => {
    mockAuth()
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])

    const res = await noShowGET(makeReq('/api/ai/no-show-risk'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.predictions).toEqual([])
    expect(body.count).toBe(0)
  })

  it('returns predictions with AI analysis', async () => {
    mockAuth()
    const now = new Date()
    vi.mocked(prisma.appointment.findMany)
      .mockResolvedValueOnce([
        {
          id: 'a1', patientId: 'p1', status: 'SCHEDULED',
          scheduledDate: new Date(now.getTime() + 86400000),
          scheduledTime: '10:00',
          appointmentType: 'CHECKUP',
          patient: { id: 'p1', firstName: 'John', lastName: 'Doe', phone: '1234567890', createdAt: new Date('2025-01-01') },
          doctor: { id: 'd1', firstName: 'Dr', lastName: 'Smith' },
        },
      ] as any)
      .mockResolvedValueOnce([
        { patientId: 'p1', scheduledDate: new Date('2025-12-01') },
      ] as any) // last visits

    vi.mocked(prisma.appointment.groupBy).mockResolvedValue([
      { patientId: 'p1', status: 'COMPLETED', _count: { id: 8 } },
      { patientId: 'p1', status: 'NO_SHOW', _count: { id: 2 } },
    ] as any)

    const aiPredictions = JSON.stringify([{
      appointmentId: 'a1', riskScore: 45, riskLevel: 'MEDIUM',
      factors: ['20% historical no-show rate'], recommendation: 'Send reminder',
    }])
    mockComplete.mockResolvedValue({ content: aiPredictions, model: 'test-model' })
    mockExtractJSON.mockReturnValue(aiPredictions)

    const res = await noShowGET(makeReq('/api/ai/no-show-risk'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.predictions).toHaveLength(1)
    expect(body.predictions[0].riskLevel).toBe('MEDIUM')
    expect(body.predictions[0].patient).toBeDefined()
    expect(body.count).toBe(1)
    expect(body.model).toBe('test-model')
  })

  it('falls back to heuristic when AI parsing fails', async () => {
    mockAuth()
    const now = new Date()
    vi.mocked(prisma.appointment.findMany)
      .mockResolvedValueOnce([
        {
          id: 'a1', patientId: 'p1', status: 'CONFIRMED',
          scheduledDate: new Date(now.getTime() + 86400000),
          scheduledTime: '14:00',
          appointmentType: 'CLEANING',
          patient: { id: 'p1', firstName: 'Jane', lastName: 'Doe', phone: '1234567890', createdAt: new Date('2025-06-01') },
          doctor: { id: 'd1', firstName: 'Dr', lastName: 'Jones' },
        },
      ] as any)
      .mockResolvedValueOnce([]) // no last visits

    vi.mocked(prisma.appointment.groupBy).mockResolvedValue([])

    mockComplete.mockResolvedValue({ content: 'invalid json response', model: 'test-model' })
    mockExtractJSON.mockReturnValue('invalid json response')

    const res = await noShowGET(makeReq('/api/ai/no-show-risk'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.predictions).toHaveLength(1)
    // CONFIRMED status starts at 15, no history adds 10 → 25 → LOW
    expect(body.predictions[0].riskLevel).toBe('LOW')
    expect(body.predictions[0].factors).toContain('New patient or limited history')
  })

  it('respects days parameter', async () => {
    mockAuth()
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])

    await noShowGET(makeReq('/api/ai/no-show-risk?days=14'))

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduledDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      })
    )
  })

  it('filters by doctorId', async () => {
    mockAuth()
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])

    await noShowGET(makeReq('/api/ai/no-show-risk?doctorId=d99'))

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ doctorId: 'd99' }),
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/ai/pricing-suggestions
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/ai/pricing-suggestions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await pricingGET(makeReq('/api/ai/pricing-suggestions') as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when hospital not found', async () => {
    mockAuth()
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([])
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])

    const res = await pricingGET(makeReq('/api/ai/pricing-suggestions') as any)
    expect(res.status).toBe(404)
  })

  it('returns pricing suggestions successfully', async () => {
    mockAuth()
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      name: 'Test Clinic', workingHours: '09:00-18:00',
    } as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        scheduledDate: new Date('2026-02-10'), scheduledTime: '10:00',
        duration: 30, status: 'COMPLETED', doctorId: 'd1',
        doctor: { firstName: 'Dr', lastName: 'Smith' },
      },
    ] as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'd1', name: 'Dr Smith' },
    ] as any)
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([
      { id: 'pr1', name: 'Cleaning', basePrice: 500, category: 'Preventive' },
    ] as any)
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { totalAmount: 5000, createdAt: new Date(), items: [{ description: 'Cleaning', amount: 500 }] },
    ] as any)

    const suggestions = { peakHours: ['10:00-12:00'], suggestedIncrease: '15%' }
    mockComplete.mockResolvedValue({
      content: JSON.stringify(suggestions),
      model: 'test-model',
      usage: { totalTokens: 800 },
    })
    mockExtractJSON.mockReturnValue(JSON.stringify(suggestions))
    vi.mocked(prisma.aISkillExecution.create).mockResolvedValue({} as any)

    const res = await pricingGET(makeReq('/api/ai/pricing-suggestions') as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.suggestions).toBeDefined()
    expect(body.model).toBe('test-model')
    expect(body.tokensUsed).toBe(800)
    expect(body.generatedAt).toBeDefined()
  })

  it('returns raw content when AI response is not parseable JSON', async () => {
    mockAuth()
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      name: 'Test Clinic', workingHours: '09:00-18:00',
    } as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([])
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])

    mockComplete.mockResolvedValue({
      content: 'Here are my recommendations in text format...',
      model: 'test-model',
      usage: { totalTokens: 500 },
    })
    mockExtractJSON.mockReturnValue('not valid json')
    vi.mocked(prisma.aISkillExecution.create).mockResolvedValue({} as any)

    const res = await pricingGET(makeReq('/api/ai/pricing-suggestions') as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.suggestions.raw).toBeDefined()
    expect(body.suggestions.error).toContain('Failed to parse')
  })

  it('logs skill execution with token usage', async () => {
    mockAuth()
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      name: 'Test Clinic', workingHours: null,
    } as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([])
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])

    mockComplete.mockResolvedValue({
      content: '{"suggestions":[]}',
      model: 'test-model',
      usage: { totalTokens: 1200 },
    })
    mockExtractJSON.mockReturnValue('{"suggestions":[]}')
    vi.mocked(prisma.aISkillExecution.create).mockResolvedValue({} as any)

    await pricingGET(makeReq('/api/ai/pricing-suggestions') as any)

    expect(prisma.aISkillExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'h1',
          userId: 'u1',
          skill: 'dynamic-pricing',
          tokensUsed: 1200,
        }),
      })
    )
  })
})
