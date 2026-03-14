import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockAI = vi.hoisted(() => ({
  complete: vi.fn(),
  extractJSON: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/ai/openrouter', () => mockAI)

const mod = await import('@/app/api/data-import/ai-mapping/route')

function makeRequest(body: any) {
  return new Request('http://localhost/api/data-import/ai-mapping', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

describe('POST /api/data-import/ai-mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('returns AI-generated column mapping', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-1',
      hospitalId: 'hospital-1',
      entityType: 'patients',
      sourceColumns: ['Name', 'Mobile', 'DOB'],
      previewData: [{ Name: 'John Doe', Mobile: '9876543210', DOB: '1990-01-15' }],
    })

    const aiResponse = JSON.stringify({
      mappings: {
        Name: { targetField: 'firstName', confidence: 0.9, notes: 'May need splitting' },
        Mobile: { targetField: 'phone', confidence: 0.95 },
        DOB: { targetField: 'dateOfBirth', confidence: 0.85 },
      },
      splitFields: [{ sourceColumn: 'Name', targetFields: ['firstName', 'lastName'], splitStrategy: 'space' }],
    })

    mockAI.complete.mockResolvedValue({ content: aiResponse })
    mockAI.extractJSON.mockReturnValue(aiResponse)
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})

    const res = await mod.POST(makeRequest({ jobId: 'job-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mapping.Name).toBe('firstName')
    expect(body.mapping.Mobile).toBe('phone')
    expect(body.mapping.DOB).toBe('dateOfBirth')
    expect(body.confidence.Mobile).toBe(0.95)
    expect(body.splitFields).toHaveLength(1)
    expect(prisma.dataImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'MAPPED' }),
      })
    )
  })

  it('returns empty mapping on AI failure (graceful fallback)', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-1',
      hospitalId: 'hospital-1',
      entityType: 'patients',
      sourceColumns: ['Col1', 'Col2'],
      previewData: [{ Col1: 'a', Col2: 'b' }],
    })

    mockAI.complete.mockRejectedValue(new Error('AI service down'))

    const res = await mod.POST(makeRequest({ jobId: 'job-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mapping.Col1).toBeNull()
    expect(body.mapping.Col2).toBeNull()
    expect(body.aiError).toContain('unavailable')
    expect(body.unmappedRequired).toBeDefined()
  })

  it('handles invalid AI JSON response gracefully', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-1',
      hospitalId: 'hospital-1',
      entityType: 'patients',
      sourceColumns: ['Name'],
      previewData: [{ Name: 'Test' }],
    })

    mockAI.complete.mockResolvedValue({ content: 'not valid json at all' })
    mockAI.extractJSON.mockReturnValue('still not json')

    const res = await mod.POST(makeRequest({ jobId: 'job-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mapping.Name).toBeNull()
    expect(body.aiError).toContain('parse')
  })

  it('returns 400 when jobId is missing', async () => {
    const res = await mod.POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('jobId')
  })

  it('returns 404 when job not found', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue(null)

    const res = await mod.POST(makeRequest({ jobId: 'nonexistent' }))
    expect(res.status).toBe(404)
  })

  it('filters out invalid target field names from AI response', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-1',
      hospitalId: 'hospital-1',
      entityType: 'patients',
      sourceColumns: ['Name', 'FakeCol'],
      previewData: [{ Name: 'A', FakeCol: 'B' }],
    })

    const aiResponse = JSON.stringify({
      mappings: {
        Name: { targetField: 'firstName', confidence: 0.9 },
        FakeCol: { targetField: 'nonExistentField', confidence: 0.5 },
      },
      splitFields: [],
    })

    mockAI.complete.mockResolvedValue({ content: aiResponse })
    mockAI.extractJSON.mockReturnValue(aiResponse)
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})

    const res = await mod.POST(makeRequest({ jobId: 'job-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mapping.Name).toBe('firstName')
    expect(body.mapping.FakeCol).toBeNull()
  })

  it('returns 401 for non-ADMIN users', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Forbidden' }, { status: 403 }),
      hospitalId: null,
    })
    const res = await mod.POST(makeRequest({ jobId: 'job-1' }))
    expect(res.status).toBe(403)
  })
})
