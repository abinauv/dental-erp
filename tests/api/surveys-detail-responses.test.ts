import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const surveyDetailModule = await import('@/app/api/communications/surveys/[id]/route')
const responsesModule = await import('@/app/api/communications/surveys/[id]/responses/route')

function makeDetailRequest(method: string, body?: any) {
  return new Request('http://localhost/api/communications/surveys/survey-1', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

function makeResponseRequest(method: string, body?: any, params?: Record<string, string>) {
  const url = new URL('http://localhost/api/communications/surveys/survey-1/responses')
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return {
    url: url.toString(),
    method,
    nextUrl: { searchParams: url.searchParams },
    headers: new Headers({
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'TestBrowser/1.0',
    }),
    json: async () => body,
  } as any
}

const ctx = { params: Promise.resolve({ id: 'survey-1' }) }

describe('Surveys Detail & Responses API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  // ─── GET /api/communications/surveys/[id] ─────────────
  describe('GET /api/communications/surveys/[id]', () => {
    it('returns survey with parsed questions and responses', async () => {
      ;(prisma.survey.findFirst as any).mockResolvedValue({
        id: 'survey-1',
        title: 'Patient Satisfaction',
        questions: JSON.stringify([{ q: 'How was your visit?', type: 'rating' }]),
        responses: [
          { id: 'r1', answers: JSON.stringify({ q1: 5 }), createdAt: new Date() },
        ],
        _count: { responses: 1 },
      })

      const res = await surveyDetailModule.GET(makeDetailRequest('GET'), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.questions).toHaveLength(1)
      expect(body.data.responses[0].answers.q1).toBe(5)
    })

    it('returns 404 when survey not found', async () => {
      ;(prisma.survey.findFirst as any).mockResolvedValue(null)

      const res = await surveyDetailModule.GET(makeDetailRequest('GET'), ctx)
      expect(res.status).toBe(404)
    })
  })

  // ─── PUT /api/communications/surveys/[id] ─────────────
  describe('PUT /api/communications/surveys/[id]', () => {
    it('updates survey title and status', async () => {
      ;(prisma.survey.findFirst as any).mockResolvedValue({ id: 'survey-1' })
      ;(prisma.survey.update as any).mockResolvedValue({
        id: 'survey-1',
        title: 'Updated Survey',
        isActive: false,
      })

      const res = await surveyDetailModule.PUT(
        makeDetailRequest('PUT', { title: 'Updated Survey', isActive: false }),
        ctx
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.title).toBe('Updated Survey')
    })

    it('returns 404 when survey not found', async () => {
      ;(prisma.survey.findFirst as any).mockResolvedValue(null)

      const res = await surveyDetailModule.PUT(
        makeDetailRequest('PUT', { title: 'Test' }),
        ctx
      )
      expect(res.status).toBe(404)
    })

    it('returns 401 for non-ADMIN/DOCTOR roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'RECEPTIONIST' } },
      })

      const res = await surveyDetailModule.PUT(
        makeDetailRequest('PUT', { title: 'Test' }),
        ctx
      )
      expect(res.status).toBe(401)
    })
  })

  // ─── DELETE /api/communications/surveys/[id] ──────────
  describe('DELETE /api/communications/surveys/[id]', () => {
    it('deletes survey', async () => {
      ;(prisma.survey.findFirst as any).mockResolvedValue({ id: 'survey-1' })
      ;(prisma.survey.delete as any).mockResolvedValue({})

      const res = await surveyDetailModule.DELETE(makeDetailRequest('DELETE'), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('deleted')
    })

    it('returns 404 when survey not found', async () => {
      ;(prisma.survey.findFirst as any).mockResolvedValue(null)

      const res = await surveyDetailModule.DELETE(makeDetailRequest('DELETE'), ctx)
      expect(res.status).toBe(404)
    })

    it('returns 401 for non-ADMIN roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'DOCTOR' } },
      })

      const res = await surveyDetailModule.DELETE(makeDetailRequest('DELETE'), ctx)
      expect(res.status).toBe(401)
    })
  })

  // ─── POST /api/communications/surveys/[id]/responses ──
  describe('POST /api/communications/surveys/[id]/responses', () => {
    it('submits response with positive sentiment (rating >= 4)', async () => {
      ;(prisma.survey.findUnique as any).mockResolvedValue({
        id: 'survey-1',
        isActive: true,
        validUntil: null,
      })
      ;(prisma.surveyResponse.create as any).mockResolvedValue({
        id: 'resp-1',
        surveyId: 'survey-1',
        rating: 5,
        sentiment: 'positive',
        isComplete: true,
      })

      const res = await responsesModule.POST(
        makeResponseRequest('POST', {
          answers: { q1: 'Great service!' },
          rating: 5,
        }),
        ctx
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      const createArgs = (prisma.surveyResponse.create as any).mock.calls[0][0].data
      expect(createArgs.sentiment).toBe('positive')
    })

    it('submits response with neutral sentiment (rating = 3)', async () => {
      ;(prisma.survey.findUnique as any).mockResolvedValue({
        id: 'survey-1',
        isActive: true,
        validUntil: null,
      })
      ;(prisma.surveyResponse.create as any).mockResolvedValue({ id: 'resp-1' })

      await responsesModule.POST(
        makeResponseRequest('POST', { answers: { q1: 'OK' }, rating: 3 }),
        ctx
      )

      const createArgs = (prisma.surveyResponse.create as any).mock.calls[0][0].data
      expect(createArgs.sentiment).toBe('neutral')
    })

    it('submits response with negative sentiment (rating < 3)', async () => {
      ;(prisma.survey.findUnique as any).mockResolvedValue({
        id: 'survey-1',
        isActive: true,
        validUntil: null,
      })
      ;(prisma.surveyResponse.create as any).mockResolvedValue({ id: 'resp-1' })

      await responsesModule.POST(
        makeResponseRequest('POST', { answers: { q1: 'Bad' }, rating: 1 }),
        ctx
      )

      const createArgs = (prisma.surveyResponse.create as any).mock.calls[0][0].data
      expect(createArgs.sentiment).toBe('negative')
    })

    it('returns 404 when survey not found', async () => {
      ;(prisma.survey.findUnique as any).mockResolvedValue(null)

      const res = await responsesModule.POST(
        makeResponseRequest('POST', { answers: { q1: 'test' } }),
        ctx
      )
      expect(res.status).toBe(404)
    })

    it('returns 400 for inactive survey', async () => {
      ;(prisma.survey.findUnique as any).mockResolvedValue({
        id: 'survey-1',
        isActive: false,
        validUntil: null,
      })

      const res = await responsesModule.POST(
        makeResponseRequest('POST', { answers: { q1: 'test' } }),
        ctx
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('not active')
    })

    it('returns 400 for expired survey', async () => {
      ;(prisma.survey.findUnique as any).mockResolvedValue({
        id: 'survey-1',
        isActive: true,
        validUntil: new Date('2020-01-01'),
      })

      const res = await responsesModule.POST(
        makeResponseRequest('POST', { answers: { q1: 'test' } }),
        ctx
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('expired')
    })
  })

  // ─── GET /api/communications/surveys/[id]/responses ───
  describe('GET /api/communications/surveys/[id]/responses', () => {
    it('returns responses with statistics', async () => {
      ;(prisma.surveyResponse.findMany as any).mockResolvedValue([
        { id: 'r1', rating: 5, sentiment: 'positive', answers: JSON.stringify({ q1: 'Great' }) },
        { id: 'r2', rating: 3, sentiment: 'neutral', answers: JSON.stringify({ q1: 'OK' }) },
        { id: 'r3', rating: 1, sentiment: 'negative', answers: JSON.stringify({ q1: 'Bad' }) },
      ])

      const res = await responsesModule.GET(
        makeResponseRequest('GET'),
        ctx
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data).toHaveLength(3)
      expect(body.statistics.totalResponses).toBe(3)
      expect(body.statistics.avgRating).toBe(3) // (5+3+1)/3
      expect(body.statistics.sentimentCounts.positive).toBe(1)
      expect(body.statistics.sentimentCounts.neutral).toBe(1)
      expect(body.statistics.sentimentCounts.negative).toBe(1)
    })

    it('handles empty responses', async () => {
      ;(prisma.surveyResponse.findMany as any).mockResolvedValue([])

      const res = await responsesModule.GET(makeResponseRequest('GET'), ctx)
      const body = await res.json()
      expect(body.statistics.totalResponses).toBe(0)
      expect(body.statistics.avgRating).toBe(0)
    })
  })
})
