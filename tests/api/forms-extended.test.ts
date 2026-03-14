import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockPdfGenerator = vi.hoisted(() => ({
  generateFormPdfHtml: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/services/pdf-generator', () => mockPdfGenerator)

const pdfModule = await import('@/app/api/forms/[id]/pdf/route')
const verifyModule = await import('@/app/api/forms/[id]/verify/route')
const settingsListModule = await import('@/app/api/settings/forms/route')
const settingsDetailModule = await import('@/app/api/settings/forms/[id]/route')
const seedModule = await import('@/app/api/settings/forms/seed/route')

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('Forms API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  // ─── GET /api/forms/[id]/pdf ──────────────────────────
  describe('GET /api/forms/[id]/pdf', () => {
    it('generates PDF HTML for a form submission', async () => {
      ;(prisma.formSubmission.findFirst as any).mockResolvedValue({
        id: 'sub-1',
        hospitalId: 'hospital-1',
        patientId: 'p1',
        signature: 'data:image/png;base64,abc',
        signedAt: new Date('2024-06-15'),
        createdAt: new Date('2024-06-15'),
        template: {
          name: 'General Consent',
          type: 'CONSENT',
          fields: [{ label: 'Patient Name', type: 'text' }],
        },
        data: { 'Patient Name': 'John Doe' },
      })

      ;(prisma.patient.findUnique as any).mockResolvedValue({
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
        dateOfBirth: new Date('1990-01-01'),
        patientId: 'PAT001',
      })

      ;(prisma.hospital.findUnique as any).mockResolvedValue({
        name: 'My Clinic',
        phone: '0001112222',
        email: 'clinic@test.com',
        address: '123 Main St',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001',
        logo: null,
      })

      mockPdfGenerator.generateFormPdfHtml.mockReturnValue('<html>PDF Content</html>')

      const req = new Request('http://localhost/api/forms/sub-1/pdf')
      const res = await pdfModule.GET(req, makeCtx('sub-1'))
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/html')
      expect(mockPdfGenerator.generateFormPdfHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicName: 'My Clinic',
          patientName: 'John Doe',
          formTitle: 'General Consent',
        })
      )
    })

    it('returns 404 when submission not found', async () => {
      ;(prisma.formSubmission.findFirst as any).mockResolvedValue(null)

      const req = new Request('http://localhost/api/forms/missing/pdf')
      const res = await pdfModule.GET(req, makeCtx('missing'))
      expect(res.status).toBe(404)
    })

    it('handles submission without patient', async () => {
      ;(prisma.formSubmission.findFirst as any).mockResolvedValue({
        id: 'sub-1',
        hospitalId: 'hospital-1',
        patientId: null,
        signature: null,
        signedAt: null,
        createdAt: new Date('2024-06-15'),
        template: {
          name: 'Feedback',
          type: 'FEEDBACK',
          fields: [{ label: 'Rating', type: 'number' }],
        },
        data: { Rating: '5' },
      })

      ;(prisma.hospital.findUnique as any).mockResolvedValue({
        name: 'My Clinic',
        phone: null,
        email: null,
        address: null,
        city: null,
        state: null,
        pincode: null,
        logo: null,
      })

      mockPdfGenerator.generateFormPdfHtml.mockReturnValue('<html></html>')

      const req = new Request('http://localhost/api/forms/sub-1/pdf')
      const res = await pdfModule.GET(req, makeCtx('sub-1'))
      expect(res.status).toBe(200)
      // Should use "Unknown Patient" as default
      expect(mockPdfGenerator.generateFormPdfHtml).toHaveBeenCalledWith(
        expect.objectContaining({ patientName: 'Unknown Patient' })
      )
    })
  })

  // ─── GET /api/forms/[id]/verify ───────────────────────
  describe('GET /api/forms/[id]/verify', () => {
    it('returns verified=true for signed submission', async () => {
      ;(prisma.formSubmission.findFirst as any).mockResolvedValue({
        id: 'sub-1',
        signature: 'data:image/png;base64,abc',
        signedAt: new Date('2024-06-15T10:00:00Z'),
        ipAddress: '192.168.1.1',
        data: JSON.stringify({ name: 'John' }),
        patientId: 'p1',
        reviewedBy: 'user-2',
        createdAt: new Date('2024-06-15'),
        status: 'SIGNED',
        reviewedAt: new Date('2024-06-16'),
        template: { name: 'General Consent', type: 'CONSENT' },
      })

      ;(prisma.patient.findUnique as any).mockResolvedValue({
        firstName: 'John',
        lastName: 'Doe',
      })

      ;(prisma.user.findUnique as any).mockResolvedValue({
        name: 'Dr. Jane Smith',
      })

      const req = new Request('http://localhost/api/forms/sub-1/verify')
      const res = await verifyModule.GET(req, makeCtx('sub-1'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.verified).toBe(true)
      expect(body.formType).toBe('CONSENT')
      expect(body.auditTrail.patientName).toBe('John Doe')
      expect(body.auditTrail.hasSignature).toBe(true)
      expect(body.auditTrail.integrityHash).toBeDefined()
      expect(body.auditTrail.integrityHash.length).toBe(64) // SHA-256 hex
      expect(body.auditTrail.reviewedBy).toBe('Dr. Jane Smith')
    })

    it('returns verified=false for unsigned submission', async () => {
      ;(prisma.formSubmission.findFirst as any).mockResolvedValue({
        id: 'sub-2',
        signature: null,
        signedAt: null,
        ipAddress: null,
        data: { name: 'Jane' },
        patientId: null,
        reviewedBy: null,
        createdAt: new Date(),
        status: 'DRAFT',
        reviewedAt: null,
        template: { name: 'Intake Form', type: 'INTAKE' },
      })

      const req = new Request('http://localhost/api/forms/sub-2/verify')
      const res = await verifyModule.GET(req, makeCtx('sub-2'))
      const body = await res.json()
      expect(body.verified).toBe(false)
      expect(body.auditTrail.hasSignature).toBe(false)
    })

    it('returns 404 when submission not found', async () => {
      ;(prisma.formSubmission.findFirst as any).mockResolvedValue(null)

      const req = new Request('http://localhost/api/forms/missing/verify')
      const res = await verifyModule.GET(req, makeCtx('missing'))
      expect(res.status).toBe(404)
    })
  })

  // ─── GET /api/settings/forms ──────────────────────────
  describe('GET /api/settings/forms', () => {
    it('returns list of templates with submission counts', async () => {
      ;(prisma.formTemplate.findMany as any).mockResolvedValue([
        { id: 't1', name: 'Consent', type: 'CONSENT', _count: { submissions: 10 } },
        { id: 't2', name: 'Intake', type: 'INTAKE', _count: { submissions: 5 } },
      ])

      const res = await settingsListModule.GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.templates).toHaveLength(2)
      expect(body.templates[0]._count.submissions).toBe(10)
    })
  })

  // ─── POST /api/settings/forms ─────────────────────────
  describe('POST /api/settings/forms', () => {
    it('creates a template with valid data', async () => {
      ;(prisma.formTemplate.create as any).mockResolvedValue({
        id: 'new-t',
        name: 'Custom Form',
        type: 'CUSTOM',
      })

      const req = new Request('http://localhost/api/settings/forms', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Custom Form',
          type: 'CUSTOM',
          fields: [{ id: 'f1', type: 'text', label: 'Name' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      }) as any
      const res = await settingsListModule.POST(req)
      expect(res.status).toBe(201)
    })

    it('returns 400 for invalid zod data', async () => {
      const req = new Request('http://localhost/api/settings/forms', {
        method: 'POST',
        body: JSON.stringify({ name: '', type: 'INVALID' }),
        headers: { 'Content-Type': 'application/json' },
      }) as any
      const res = await settingsListModule.POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('Invalid')
    })

    it('returns 400 when fields array is empty', async () => {
      const req = new Request('http://localhost/api/settings/forms', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test',
          type: 'CONSENT',
          fields: [],
        }),
        headers: { 'Content-Type': 'application/json' },
      }) as any
      const res = await settingsListModule.POST(req)
      expect(res.status).toBe(400)
    })
  })

  // ─── GET /api/settings/forms/[id] ─────────────────────
  describe('GET /api/settings/forms/[id]', () => {
    it('returns template with recent submissions', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue({
        id: 't1',
        name: 'Consent',
        submissions: [
          { id: 's1', status: 'SIGNED', createdAt: new Date() },
        ],
        _count: { submissions: 1 },
      })

      const req = new Request('http://localhost/api/settings/forms/t1') as any
      const res = await settingsDetailModule.GET(req, makeCtx('t1'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.template.submissions).toHaveLength(1)
    })

    it('returns 404 when template not found', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue(null)

      const req = new Request('http://localhost/api/settings/forms/missing') as any
      const res = await settingsDetailModule.GET(req, makeCtx('missing'))
      expect(res.status).toBe(404)
    })
  })

  // ─── PUT /api/settings/forms/[id] ─────────────────────
  describe('PUT /api/settings/forms/[id]', () => {
    it('updates template fields', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue({ id: 't1' })
      ;(prisma.formTemplate.update as any).mockResolvedValue({
        id: 't1',
        name: 'Updated Consent',
        type: 'CONSENT',
      })

      const req = new Request('http://localhost/api/settings/forms/t1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Consent' }),
        headers: { 'Content-Type': 'application/json' },
      }) as any
      const res = await settingsDetailModule.PUT(req, makeCtx('t1'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.template.name).toBe('Updated Consent')
    })

    it('returns 404 when template not found', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue(null)

      const req = new Request('http://localhost/api/settings/forms/missing', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      }) as any
      const res = await settingsDetailModule.PUT(req, makeCtx('missing'))
      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid zod data', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue({ id: 't1' })

      const req = new Request('http://localhost/api/settings/forms/t1', {
        method: 'PUT',
        body: JSON.stringify({ type: 'INVALID_TYPE' }),
        headers: { 'Content-Type': 'application/json' },
      }) as any
      const res = await settingsDetailModule.PUT(req, makeCtx('t1'))
      expect(res.status).toBe(400)
    })
  })

  // ─── DELETE /api/settings/forms/[id] ──────────────────
  describe('DELETE /api/settings/forms/[id]', () => {
    it('hard deletes template with no submissions', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue({
        id: 't1',
        _count: { submissions: 0 },
      })
      ;(prisma.formTemplate.delete as any).mockResolvedValue({})

      const req = new Request('http://localhost/api/settings/forms/t1', { method: 'DELETE' }) as any
      const res = await settingsDetailModule.DELETE(req, makeCtx('t1'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('deleted')
      expect(prisma.formTemplate.delete).toHaveBeenCalled()
    })

    it('soft deletes (deactivates) template with submissions', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue({
        id: 't1',
        _count: { submissions: 5 },
      })
      ;(prisma.formTemplate.update as any).mockResolvedValue({})

      const req = new Request('http://localhost/api/settings/forms/t1', { method: 'DELETE' }) as any
      const res = await settingsDetailModule.DELETE(req, makeCtx('t1'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('deactivated')
      expect(prisma.formTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } })
      )
    })

    it('returns 404 when template not found', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue(null)

      const req = new Request('http://localhost/api/settings/forms/missing', { method: 'DELETE' }) as any
      const res = await settingsDetailModule.DELETE(req, makeCtx('missing'))
      expect(res.status).toBe(404)
    })
  })

  // ─── POST /api/settings/forms/seed ────────────────────
  describe('POST /api/settings/forms/seed', () => {
    it('creates 3 default templates', async () => {
      ;(prisma.formTemplate.count as any).mockResolvedValue(0)

      const created = [
        { id: 't1', name: 'General Dental Consent', type: 'CONSENT' },
        { id: 't2', name: 'Extraction / Surgical Consent', type: 'CONSENT' },
        { id: 't3', name: 'Patient Registration / Intake Form', type: 'INTAKE' },
      ]
      ;(prisma.$transaction as any).mockResolvedValue(created)

      const res = await seedModule.POST()
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.templates).toHaveLength(3)
      expect(body.message).toContain('3')
    })

    it('returns 200 when defaults already exist', async () => {
      ;(prisma.formTemplate.count as any).mockResolvedValue(3)

      const res = await seedModule.POST()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('already exist')
    })

    it('returns 401 for non-ADMIN', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Forbidden' }, { status: 403 }),
        hospitalId: null,
        session: null,
      })

      const res = await seedModule.POST()
      expect(res.status).toBe(403)
    })
  })
})
