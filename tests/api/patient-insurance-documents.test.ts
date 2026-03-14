import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('fs/promises', () => {
  const m = {
    readFile: vi.fn(),
    unlink: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  }
  return { ...m, default: m }
})
vi.mock('fs', () => {
  const m = { existsSync: vi.fn(() => true) }
  return { ...m, default: m }
})
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal() as any
  return { ...actual, default: actual }
})

const insuranceModule = await import('@/app/api/patients/[id]/insurance/route')
const docDetailModule = await import('@/app/api/patients/[id]/documents/[documentId]/route')
const docListModule = await import('@/app/api/patients/[id]/documents/route')

function makeInsuranceRequest(method: string, body?: any) {
  return new Request('http://localhost/api/patients/p1/insurance', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

function makeDocDetailRequest(method: string, params: Record<string, string> = {}, body?: any) {
  const url = new URL('http://localhost/api/patients/p1/documents/doc-1')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString(), {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

function makeDocListRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/patients/p1/documents')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString()) as any
}

const insuranceCtx = { params: Promise.resolve({ id: 'p1' }) }
const docDetailCtx = { params: Promise.resolve({ id: 'p1', documentId: 'doc-1' }) }
const docListCtx = { params: Promise.resolve({ id: 'p1' }) }

describe('Patient Insurance & Documents API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
      user: { id: 'user-1' },
    })
  })

  // ─── GET /api/patients/[id]/insurance ─────────────
  describe('GET /api/patients/[id]/insurance', () => {
    it('returns insurance policies for a patient', async () => {
      ;(prisma.patientInsurance.findMany as any).mockResolvedValue([
        {
          id: 'ins-1',
          policyNumber: 'POL001',
          isActive: true,
          provider: { id: 'prov-1', name: 'Star Health', code: 'STAR', contactPhone: '1234567890' },
        },
        {
          id: 'ins-2',
          policyNumber: 'POL002',
          isActive: false,
          provider: { id: 'prov-2', name: 'ICICI Lombard', code: 'ICICI', contactPhone: '0987654321' },
        },
      ])

      const res = await insuranceModule.GET(makeInsuranceRequest('GET'), insuranceCtx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveLength(2)
      expect(body[0].provider.name).toBe('Star Health')
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
        session: null,
      })

      const res = await insuranceModule.GET(makeInsuranceRequest('GET'), insuranceCtx)
      expect(res.status).toBe(401)
    })
  })

  // ─── POST /api/patients/[id]/insurance ────────────
  describe('POST /api/patients/[id]/insurance', () => {
    it('creates a new insurance policy', async () => {
      ;(prisma.patientInsurance.create as any).mockResolvedValue({
        id: 'ins-new',
        policyNumber: 'POL999',
        provider: { id: 'prov-1', name: 'Star Health' },
      })

      const res = await insuranceModule.POST(
        makeInsuranceRequest('POST', {
          providerId: 'prov-1',
          policyNumber: 'POL999',
          memberId: 'MEM001',
          subscriberName: 'John Doe',
          effectiveDate: '2026-01-01',
          annualMaximum: '500000',
        }),
        insuranceCtx
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.policyNumber).toBe('POL999')
    })

    it('returns 400 when required fields missing', async () => {
      const res = await insuranceModule.POST(
        makeInsuranceRequest('POST', { providerId: 'prov-1' }),
        insuranceCtx
      )
      expect(res.status).toBe(400)
    })

    it('returns 401 for unauthorized roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Forbidden' }, { status: 403 }),
        hospitalId: null,
        session: null,
      })

      const res = await insuranceModule.POST(
        makeInsuranceRequest('POST', {
          providerId: 'prov-1',
          policyNumber: 'POL999',
          memberId: 'MEM001',
          subscriberName: 'John Doe',
          effectiveDate: '2026-01-01',
        }),
        insuranceCtx
      )
      expect(res.status).toBe(403)
    })
  })

  // ─── PUT /api/patients/[id]/insurance ─────────────
  describe('PUT /api/patients/[id]/insurance', () => {
    it('updates an existing policy', async () => {
      ;(prisma.patientInsurance.updateMany as any).mockResolvedValue({ count: 1 })

      const res = await insuranceModule.PUT(
        makeInsuranceRequest('PUT', {
          policyId: 'ins-1',
          policyNumber: 'POL001-UPDATED',
          isActive: false,
        }),
        insuranceCtx
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('returns 400 when policyId missing', async () => {
      const res = await insuranceModule.PUT(
        makeInsuranceRequest('PUT', { policyNumber: 'POL001' }),
        insuranceCtx
      )
      expect(res.status).toBe(400)
    })

    it('returns 404 when policy not found', async () => {
      ;(prisma.patientInsurance.updateMany as any).mockResolvedValue({ count: 0 })

      const res = await insuranceModule.PUT(
        makeInsuranceRequest('PUT', { policyId: 'ins-999' }),
        insuranceCtx
      )
      expect(res.status).toBe(404)
    })
  })

  // ─── GET /api/patients/[id]/documents (list) ─────
  describe('GET /api/patients/[id]/documents', () => {
    it('returns documents for a patient', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })
      ;(prisma.document.findMany as any).mockResolvedValue([
        { id: 'doc-1', documentType: 'XRAY', originalName: 'xray.jpg', treatment: null },
        { id: 'doc-2', documentType: 'PRESCRIPTION', originalName: 'rx.pdf', treatment: { id: 't1', procedure: { name: 'Filling' } } },
      ])

      const res = await docListModule.GET(makeDocListRequest(), docListCtx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.documents).toHaveLength(2)
    })

    it('filters by type and treatmentId', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })
      ;(prisma.document.findMany as any).mockResolvedValue([])

      await docListModule.GET(
        makeDocListRequest({ type: 'XRAY', treatmentId: 't1' }),
        docListCtx
      )
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentType: 'XRAY',
            treatmentId: 't1',
          }),
        })
      )
    })

    it('returns 404 when patient not found', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)

      const res = await docListModule.GET(makeDocListRequest(), docListCtx)
      expect(res.status).toBe(404)
    })
  })

  // ─── GET /api/patients/[id]/documents/[documentId] (metadata) ──
  describe('GET /api/patients/[id]/documents/[documentId]', () => {
    it('returns document metadata', async () => {
      ;(prisma.document.findFirst as any).mockResolvedValue({
        id: 'doc-1',
        originalName: 'xray.jpg',
        documentType: 'XRAY',
        fileType: 'image/jpeg',
        fileSize: 102400,
      })

      const res = await docDetailModule.GET(makeDocDetailRequest('GET'), docDetailCtx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.document.originalName).toBe('xray.jpg')
    })

    it('returns 404 when document not found', async () => {
      ;(prisma.document.findFirst as any).mockResolvedValue(null)

      const res = await docDetailModule.GET(makeDocDetailRequest('GET'), docDetailCtx)
      expect(res.status).toBe(404)
    })
  })

  // ─── PATCH /api/patients/[id]/documents/[documentId] ──
  describe('PATCH /api/patients/[id]/documents/[documentId]', () => {
    it('updates document metadata', async () => {
      ;(prisma.document.findFirst as any).mockResolvedValue({ id: 'doc-1' })
      ;(prisma.document.update as any).mockResolvedValue({
        id: 'doc-1',
        description: 'Updated description',
        documentType: 'REPORT',
      })

      const res = await docDetailModule.PATCH(
        makeDocDetailRequest('PATCH', {}, { description: 'Updated description', documentType: 'REPORT' }),
        docDetailCtx
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.document.description).toBe('Updated description')
    })

    it('returns 404 when document not found', async () => {
      ;(prisma.document.findFirst as any).mockResolvedValue(null)

      const res = await docDetailModule.PATCH(
        makeDocDetailRequest('PATCH', {}, { description: 'test' }),
        docDetailCtx
      )
      expect(res.status).toBe(404)
    })
  })

  // ─── DELETE /api/patients/[id]/documents/[documentId] ──
  describe('DELETE /api/patients/[id]/documents/[documentId]', () => {
    it('soft deletes (archives) a document by default', async () => {
      ;(prisma.document.findFirst as any).mockResolvedValue({
        id: 'doc-1',
        filePath: '/uploads/hospital-1/documents/p1/file.jpg',
      })
      ;(prisma.document.update as any).mockResolvedValue({ id: 'doc-1', isArchived: true })

      const res = await docDetailModule.DELETE(makeDocDetailRequest('DELETE'), docDetailCtx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('archived')
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isArchived: true },
        })
      )
    })

    it('permanently deletes a document when permanent=true', async () => {
      ;(prisma.document.findFirst as any).mockResolvedValue({
        id: 'doc-1',
        filePath: '/uploads/hospital-1/documents/p1/file.jpg',
      })
      ;(prisma.document.delete as any).mockResolvedValue({})

      const res = await docDetailModule.DELETE(
        makeDocDetailRequest('DELETE', { permanent: 'true' }),
        docDetailCtx
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('permanently deleted')
      expect(prisma.document.delete).toHaveBeenCalled()
    })

    it('returns 404 when document not found', async () => {
      ;(prisma.document.findFirst as any).mockResolvedValue(null)

      const res = await docDetailModule.DELETE(makeDocDetailRequest('DELETE'), docDetailCtx)
      expect(res.status).toBe(404)
    })
  })
})
