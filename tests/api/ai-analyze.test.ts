import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockOpenRouter = vi.hoisted(() => ({
  complete: vi.fn(),
  extractJSON: vi.fn((s: string) => s),
}))

const mockModels = vi.hoisted(() => ({
  getModelByTier: vi.fn(() => ({ model: 'test-model', maxTokens: 4096 })),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/ai/openrouter', () => mockOpenRouter)
vi.mock('@/lib/ai/models', () => mockModels)

const mod = await import('@/app/api/ai/analyze/route')

function makeRequest(body?: any) {
  return new Request('http://localhost/api/ai/analyze', {
    method: 'POST',
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

describe('POST /api/ai/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
      user: { id: 'user-1', name: 'Admin', role: 'ADMIN' },
    })
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      hospitalId: null,
      user: null,
    })
    const res = await mod.POST(makeRequest({ type: 'risk_score' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/ai/analyze', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    }) as any
    const res = await mod.POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for unsupported analysis type', async () => {
    const res = await mod.POST(makeRequest({ type: 'unknown' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Unsupported analysis type')
  })

  // risk_score type
  it('returns 400 when risk_score without patientId', async () => {
    const res = await mod.POST(makeRequest({ type: 'risk_score' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('patientId is required')
  })

  it('returns 404 when patient not found', async () => {
    ;(prisma.patient.findUnique as any).mockResolvedValue(null)
    const res = await mod.POST(makeRequest({ type: 'risk_score', patientId: 'p1' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when patient has no medical history', async () => {
    ;(prisma.patient.findUnique as any).mockResolvedValue({ id: 'p1', medicalHistory: null })
    const res = await mod.POST(makeRequest({ type: 'risk_score', patientId: 'p1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No medical history')
  })

  it('calculates risk score with AI and persists it', async () => {
    ;(prisma.patient.findUnique as any).mockResolvedValue({
      id: 'p1',
      medicalHistory: {
        drugAllergies: 'Penicillin',
        hasDiabetes: true,
        diabetesType: 'Type 2',
        hasHypertension: false,
        hasHeartDisease: false,
        hasHepatitis: false,
        hasHiv: false,
        hasEpilepsy: false,
        isPregnant: false,
        hasBleedingDisorder: false,
        smokingStatus: 'NEVER',
        alcoholConsumption: 'NEVER',
        currentMedications: null,
        otherConditions: null,
      },
    })

    const aiResult = {
      overallScore: 25,
      factors: [{ factor: 'Drug allergies', score: 15, explanation: 'Penicillin allergy' }],
      contraindications: ['Avoid penicillin-based antibiotics'],
      recommendation: 'Low risk with allergy precautions',
    }

    mockOpenRouter.complete.mockResolvedValue({
      content: JSON.stringify(aiResult),
      usage: { totalTokens: 500 },
    })
    mockOpenRouter.extractJSON.mockReturnValue(JSON.stringify(aiResult))
    ;(prisma.patientRiskScore.create as any).mockResolvedValue({})
    ;(prisma.aISkillExecution.create as any).mockResolvedValue({})

    const res = await mod.POST(makeRequest({ type: 'risk_score', patientId: 'p1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.overallScore).toBe(25)
    expect(prisma.patientRiskScore.create).toHaveBeenCalled()
    expect(prisma.aISkillExecution.create).toHaveBeenCalled()
  })

  it('returns 502 when AI fails for risk_score', async () => {
    ;(prisma.patient.findUnique as any).mockResolvedValue({
      id: 'p1',
      medicalHistory: { drugAllergies: null, hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasHepatitis: false, hasHiv: false, hasEpilepsy: false, isPregnant: false, hasBleedingDisorder: false, smokingStatus: 'NEVER', alcoholConsumption: 'NEVER', currentMedications: null, otherConditions: null },
    })
    mockOpenRouter.complete.mockRejectedValue(new Error('AI service down'))

    const res = await mod.POST(makeRequest({ type: 'risk_score', patientId: 'p1' }))
    expect(res.status).toBe(502)
  })

  // data type
  it('returns 400 when data type without data field', async () => {
    const res = await mod.POST(makeRequest({ type: 'data' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('data field is required')
  })

  it('performs generic data analysis', async () => {
    mockOpenRouter.complete.mockResolvedValue({
      content: 'Analysis results here',
      usage: { totalTokens: 200 },
    })

    const res = await mod.POST(makeRequest({ type: 'data', data: 'Some data to analyze' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analysis).toBe('Analysis results here')
  })

  it('returns 502 when AI fails for data analysis', async () => {
    mockOpenRouter.complete.mockRejectedValue(new Error('AI error'))
    const res = await mod.POST(makeRequest({ type: 'data', data: 'test' }))
    expect(res.status).toBe(502)
  })
})
