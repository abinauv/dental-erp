import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ default: prisma }))

const mod = await import('@/app/api/patients/[id]/documents/[documentId]/annotations/route')

function makeJsonRequest(method: string, body?: any) {
  return new Request('http://localhost/api/patients/p1/documents/doc-1/annotations', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

const ctx = { params: Promise.resolve({ id: 'p1', documentId: 'doc-1' }) }

describe('PUT /api/patients/[id]/documents/[documentId]/annotations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'DOCTOR' } },
    })
  })

  it('saves annotations to a document', async () => {
    const annotations = [
      { x: 10, y: 20, text: 'Cavity observed', type: 'marker' },
      { x: 50, y: 60, text: 'Discoloration', type: 'highlight' },
    ]
    ;(prisma.document.findFirst as any).mockResolvedValue({ id: 'doc-1', patientId: 'p1', hospitalId: 'hospital-1' })
    ;(prisma.document.update as any).mockResolvedValue({
      annotations,
      annotatedBy: 'user-1',
      annotatedAt: new Date(),
    })

    const req = makeJsonRequest('PUT', { annotations })
    const res = await mod.PUT(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.annotations).toHaveLength(2)
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ annotations, annotatedBy: 'user-1' }),
      })
    )
  })

  it('returns 403 for non-DOCTOR/ADMIN roles', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'RECEPTIONIST' } },
    })

    const req = makeJsonRequest('PUT', { annotations: [] })
    const res = await mod.PUT(req, ctx)
    expect(res.status).toBe(403)
  })

  it('returns 400 when annotations is not an array', async () => {
    const req = makeJsonRequest('PUT', { annotations: 'not an array' })
    const res = await mod.PUT(req, ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('array')
  })

  it('returns 404 when document not found', async () => {
    ;(prisma.document.findFirst as any).mockResolvedValue(null)

    const req = makeJsonRequest('PUT', { annotations: [] })
    const res = await mod.PUT(req, ctx)
    expect(res.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      hospitalId: null,
      session: null,
    })

    const req = makeJsonRequest('PUT', { annotations: [] })
    const res = await mod.PUT(req, ctx)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/patients/[id]/documents/[documentId]/annotations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'DOCTOR' } },
    })
  })

  it('returns annotations for a document', async () => {
    ;(prisma.document.findFirst as any).mockResolvedValue({
      annotations: [{ x: 10, y: 20, text: 'Note' }],
      annotatedBy: 'user-1',
      annotatedAt: new Date('2026-01-15'),
    })

    const req = makeJsonRequest('GET')
    const res = await mod.GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.annotations).toHaveLength(1)
    expect(body.annotatedBy).toBe('user-1')
  })

  it('returns empty array when no annotations', async () => {
    ;(prisma.document.findFirst as any).mockResolvedValue({
      annotations: null,
      annotatedBy: null,
      annotatedAt: null,
    })

    const req = makeJsonRequest('GET')
    const res = await mod.GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.annotations).toEqual([])
  })

  it('returns 404 when document not found', async () => {
    ;(prisma.document.findFirst as any).mockResolvedValue(null)

    const req = makeJsonRequest('GET')
    const res = await mod.GET(req, ctx)
    expect(res.status).toBe(404)
  })
})
