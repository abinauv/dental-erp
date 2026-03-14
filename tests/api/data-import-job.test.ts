import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const mod = await import('@/app/api/data-import/[id]/route')

const ctx = { params: Promise.resolve({ id: 'job-1' }) }

describe('GET /api/data-import/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('returns import job details', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-1',
      fileName: 'patients.csv',
      entityType: 'patients',
      status: 'UPLOADED',
      totalRows: 100,
      user: { name: 'Admin User', email: 'admin@test.com' },
    })

    const req = new Request('http://localhost/api/data-import/job-1') as any
    const res = await mod.GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.job.fileName).toBe('patients.csv')
    expect(body.job.user.name).toBe('Admin User')
  })

  it('returns 404 when job not found', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue(null)

    const req = new Request('http://localhost/api/data-import/nonexistent') as any
    const res = await mod.GET(req, ctx)
    expect(res.status).toBe(404)
  })

  it('returns 401 for non-ADMIN', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Forbidden' }, { status: 403 }),
      hospitalId: null,
    })

    const req = new Request('http://localhost/api/data-import/job-1') as any
    const res = await mod.GET(req, ctx)
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/data-import/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('cancels an import job', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-1',
      hospitalId: 'hospital-1',
      status: 'UPLOADED',
    })
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})

    const req = new Request('http://localhost/api/data-import/job-1', { method: 'DELETE' }) as any
    const res = await mod.DELETE(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(prisma.dataImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'CANCELLED' },
      })
    )
  })

  it('returns 404 when job not found', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue(null)

    const req = new Request('http://localhost/api/data-import/nonexistent', { method: 'DELETE' }) as any
    const res = await mod.DELETE(req, ctx)
    expect(res.status).toBe(404)
  })

  it('returns 401 for non-ADMIN', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Forbidden' }, { status: 403 }),
      hospitalId: null,
    })

    const req = new Request('http://localhost/api/data-import/job-1', { method: 'DELETE' }) as any
    const res = await mod.DELETE(req, ctx)
    expect(res.status).toBe(403)
  })
})
