import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockStorage = vi.hoisted(() => ({
  name: 'local' as const,
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  getSignedUrl: vi.fn(),
}))

const mockParsers = vi.hoisted(() => ({
  parseFile: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/storage', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return { ...actual, getStorage: () => mockStorage }
})
vi.mock('@/lib/import/parsers', () => mockParsers)

const mod = await import('@/app/api/data-import/validate/route')

function makeRequest(body: any) {
  return new Request('http://localhost/api/data-import/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

describe('POST /api/data-import/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('reads an import job created before the storage refactor', async () => {
    // Jobs already in the database hold "uploads/{hospitalId}/imports/...".
    // They have to keep validating after an upgrade, without a data migration.
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-1',
      hospitalId: 'hospital-1',
      entityType: 'patients',
      filePath: 'uploads/hospital-1/imports/legacy.csv',
      fileType: 'csv',
    })
    mockStorage.get.mockResolvedValue({
      body: Buffer.from('data'),
      contentType: 'text/csv',
      size: 4,
    })
    mockParsers.parseFile.mockResolvedValue({ columns: ['Name'], rows: [], totalRows: 0 })
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})

    const res = await mod.POST(makeRequest({ jobId: 'job-1', mapping: { Name: 'firstName' } }))

    expect(res.status).toBe(200)
    expect(mockStorage.get).toHaveBeenCalledWith('hospital-1/imports/legacy.csv')
  })

  it('validates rows and returns valid result', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-1',
      hospitalId: 'hospital-1',
      entityType: 'patients',
      filePath: 'uploads/hospital-1/imports/test.csv',
      fileType: 'csv',
    })

    mockStorage.get.mockResolvedValue({
      body: Buffer.from('data'),
      contentType: 'text/csv',
      size: 4,
    })
    mockParsers.parseFile.mockResolvedValue({
      columns: ['Name', 'Phone'],
      rows: [{ Name: 'John Doe', Phone: '9876543210' }],
      totalRows: 1,
    })

    // No duplicates
    ;(prisma.patient.findMany as any).mockResolvedValue([])
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})

    const res = await mod.POST(
      makeRequest({
        jobId: 'job-1',
        mapping: { Name: 'firstName', Phone: 'phone' },
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalRows).toBe(1)
    expect(body.transformedPreview).toBeDefined()
    expect(body.valid).toBeDefined()
  })

  it('detects duplicate patients by phone', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-1',
      hospitalId: 'hospital-1',
      entityType: 'patients',
      filePath: 'uploads/hospital-1/imports/test.csv',
      fileType: 'csv',
    })

    mockStorage.get.mockResolvedValue({
      body: Buffer.from('data'),
      contentType: 'text/csv',
      size: 4,
    })
    mockParsers.parseFile.mockResolvedValue({
      columns: ['Name', 'Phone'],
      rows: [{ Name: 'John', Phone: '9876543210' }],
      totalRows: 1,
    })

    ;(prisma.patient.findMany as any).mockResolvedValue([
      { phone: '9876543210', patientId: 'PAT-00001' },
    ])
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})

    const res = await mod.POST(
      makeRequest({
        jobId: 'job-1',
        mapping: { Name: 'firstName', Phone: 'phone' },
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.warningCount).toBeGreaterThanOrEqual(1)
    const phoneWarning = body.errors.find((e: any) => e.field === 'phone')
    expect(phoneWarning).toBeDefined()
    expect(phoneWarning.message).toContain('duplicate')
  })

  it('returns 400 when jobId is missing', async () => {
    const res = await mod.POST(makeRequest({ mapping: {} }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when mapping is missing', async () => {
    const res = await mod.POST(makeRequest({ jobId: 'job-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when job not found', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue(null)

    const res = await mod.POST(makeRequest({ jobId: 'nonexistent', mapping: {} }))
    expect(res.status).toBe(404)
  })

  it('returns 401 for non-ADMIN users', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Forbidden' }, { status: 403 }),
      hospitalId: null,
    })
    const res = await mod.POST(makeRequest({ jobId: 'job-1', mapping: {} }))
    expect(res.status).toBe(403)
  })
})
