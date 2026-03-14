import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ default: prisma }))
vi.mock('fs/promises', () => {
  const m = { writeFile: vi.fn(), mkdir: vi.fn() }
  return { ...m, default: m }
})
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal() as any
  return { ...actual, default: actual }
})
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal() as any
  return { ...actual, randomUUID: () => 'mock-uuid-1234' }
})

const mod = await import('@/app/api/patients/[id]/documents/route')

function makeMockFormDataRequest(fields: Record<string, any>) {
  const formData = new Map<string, any>()
  for (const [k, v] of Object.entries(fields)) formData.set(k, v)
  return {
    formData: vi.fn().mockResolvedValue({ get: (key: string) => formData.get(key) ?? null }),
    url: 'http://localhost/api/patients/p1/documents',
  } as any
}

describe('POST /api/patients/[id]/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
      user: { id: 'user-1', name: 'Admin', role: 'ADMIN' },
    })
  })

  it('uploads a document and creates record', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1', hospitalId: 'hospital-1' })
    ;(prisma.document.create as any).mockResolvedValue({
      id: 'doc-1',
      fileName: 'mock-uuid-1234.pdf',
      originalName: 'report.pdf',
      documentType: 'REPORT',
    })

    const mockFile = {
      name: 'report.pdf',
      type: 'application/pdf',
      size: 102400,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }

    const req = makeMockFormDataRequest({ file: mockFile, documentType: 'REPORT', description: 'Blood report' })
    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const res = await mod.POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.document.originalName).toBe('report.pdf')
    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'p1',
          hospitalId: 'hospital-1',
          documentType: 'REPORT',
        }),
      })
    )
  })

  it('returns 404 when patient not found', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue(null)

    const mockFile = { name: 'x.pdf', type: 'application/pdf', size: 100, arrayBuffer: vi.fn() }
    const req = makeMockFormDataRequest({ file: mockFile, documentType: 'REPORT' })
    const ctx = { params: Promise.resolve({ id: 'p-unknown' }) }
    const res = await mod.POST(req, ctx)
    expect(res.status).toBe(404)
  })

  it('returns 400 when no file provided', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1', hospitalId: 'hospital-1' })

    const req = makeMockFormDataRequest({ documentType: 'REPORT' })
    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const res = await mod.POST(req, ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No file')
  })

  it('returns 400 when documentType missing', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1', hospitalId: 'hospital-1' })
    const mockFile = { name: 'x.pdf', type: 'application/pdf', size: 100, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1)) }

    const req = makeMockFormDataRequest({ file: mockFile })
    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const res = await mod.POST(req, ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Document type')
  })

  it('returns 400 for disallowed file type', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1', hospitalId: 'hospital-1' })
    const mockFile = { name: 'script.exe', type: 'application/x-msdownload', size: 100, arrayBuffer: vi.fn() }

    const req = makeMockFormDataRequest({ file: mockFile, documentType: 'REPORT' })
    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const res = await mod.POST(req, ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('not allowed')
  })

  it('returns 400 for oversized file (>10MB)', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1', hospitalId: 'hospital-1' })
    const mockFile = { name: 'big.pdf', type: 'application/pdf', size: 11 * 1024 * 1024, arrayBuffer: vi.fn() }

    const req = makeMockFormDataRequest({ file: mockFile, documentType: 'REPORT' })
    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const res = await mod.POST(req, ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('10MB')
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      hospitalId: null,
      user: null,
    })

    const req = makeMockFormDataRequest({})
    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const res = await mod.POST(req, ctx)
    expect(res.status).toBe(401)
  })
})
