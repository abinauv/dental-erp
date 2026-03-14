import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockFs = vi.hoisted(() => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}))

const mockParsers = vi.hoisted(() => ({
  parseFile: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('fs/promises', () => ({ ...mockFs, default: mockFs }))
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal() as any
  return { ...actual, default: actual }
})
vi.mock('@/lib/import/parsers', () => mockParsers)

const mod = await import('@/app/api/data-import/upload/route')

function makeMockFormDataRequest(fields: Record<string, any>) {
  const data = new Map<string, any>()
  for (const [k, v] of Object.entries(fields)) {
    if (v !== null) data.set(k, v)
  }
  return {
    formData: vi.fn().mockResolvedValue({
      get: (key: string) => data.get(key) ?? null,
    }),
  } as any
}

describe('POST /api/data-import/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('uploads file and creates import job', async () => {
    const mockFile = {
      name: 'patients.csv',
      size: 5000,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }

    mockParsers.parseFile.mockResolvedValue({
      columns: ['Name', 'Phone', 'Email'],
      rows: [
        { Name: 'John Doe', Phone: '9876543210', Email: 'john@test.com' },
        { Name: 'Jane Smith', Phone: '9876543211', Email: 'jane@test.com' },
      ],
      totalRows: 2,
    })

    ;(prisma.dataImportJob.create as any).mockResolvedValue({
      id: 'job-1',
    })

    const req = makeMockFormDataRequest({ file: mockFile, entityType: 'patients' })
    const res = await mod.POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobId).toBe('job-1')
    expect(body.columns).toEqual(['Name', 'Phone', 'Email'])
    expect(body.totalRows).toBe(2)
    expect(body.sampleData).toHaveLength(2)
    expect(prisma.dataImportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'hospital-1',
          entityType: 'patients',
          status: 'UPLOADED',
        }),
      })
    )
  })

  it('returns 400 when no file provided', async () => {
    const req = makeMockFormDataRequest({ entityType: 'patients' })
    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No file')
  })

  it('returns 400 for invalid entity type', async () => {
    const mockFile = { name: 'data.csv', size: 100, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }
    const req = makeMockFormDataRequest({ file: mockFile, entityType: 'invalid' })
    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid entity type')
  })

  it('returns 400 for unsupported file extension', async () => {
    const mockFile = { name: 'data.doc', size: 100, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }
    const req = makeMockFormDataRequest({ file: mockFile, entityType: 'patients' })
    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Unsupported file type')
  })

  it('returns 400 for oversized file (>20MB)', async () => {
    const mockFile = { name: 'big.csv', size: 25 * 1024 * 1024, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }
    const req = makeMockFormDataRequest({ file: mockFile, entityType: 'patients' })
    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('20MB')
  })

  it('returns 400 when file has no columns', async () => {
    const mockFile = { name: 'empty.csv', size: 10, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }
    mockParsers.parseFile.mockResolvedValue({ columns: [], rows: [], totalRows: 0 })

    const req = makeMockFormDataRequest({ file: mockFile, entityType: 'patients' })
    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No column')
  })

  it('returns 400 when file has no data rows', async () => {
    const mockFile = { name: 'headers-only.csv', size: 20, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }
    mockParsers.parseFile.mockResolvedValue({ columns: ['Name'], rows: [], totalRows: 0 })

    const req = makeMockFormDataRequest({ file: mockFile, entityType: 'patients' })
    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('no data')
  })

  it('returns 401 for non-ADMIN users', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Forbidden' }, { status: 403 }),
      hospitalId: null,
    })
    const req = makeMockFormDataRequest({})
    const res = await mod.POST(req)
    expect(res.status).toBe(403)
  })
})
