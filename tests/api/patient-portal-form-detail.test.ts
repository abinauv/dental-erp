import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockPatientAuth = vi.hoisted(() => ({
  requirePatientAuth: vi.fn(),
}))

vi.mock('@/lib/patient-auth', () => mockPatientAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const formDetailModule = await import('@/app/api/patient-portal/forms/[id]/route')

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/patient-portal/forms/template-1')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString()) as any
}

const ctx = { params: Promise.resolve({ id: 'template-1' }) }

describe('Patient Portal Form Detail API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPatientAuth.requirePatientAuth.mockResolvedValue({
      error: null,
      patient: { id: 'patient-1', hospitalId: 'hospital-1' },
    })
  })

  describe('GET /api/patient-portal/forms/[id]', () => {
    it('returns template and existing submission', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue({
        id: 'template-1',
        name: 'Medical History',
        fields: JSON.stringify([{ name: 'allergies', type: 'text' }]),
        isActive: true,
      })
      ;(prisma.formSubmission.findFirst as any).mockResolvedValue({
        id: 'sub-1',
        templateId: 'template-1',
        patientId: 'patient-1',
        data: JSON.stringify({ allergies: 'Penicillin' }),
        createdAt: new Date(),
      })

      const res = await formDetailModule.GET(makeRequest(), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.template.name).toBe('Medical History')
      expect(body.existingSubmission.id).toBe('sub-1')
    })

    it('returns template with null submission when patient has not submitted', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue({
        id: 'template-1',
        name: 'Consent Form',
        isActive: true,
      })
      ;(prisma.formSubmission.findFirst as any).mockResolvedValue(null)

      const res = await formDetailModule.GET(makeRequest(), ctx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.template).toBeDefined()
      expect(body.existingSubmission).toBeNull()
    })

    it('returns 404 when template not found', async () => {
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue(null)

      const res = await formDetailModule.GET(makeRequest(), ctx)
      expect(res.status).toBe(404)
    })

    it('returns 404 when template is inactive', async () => {
      // findFirst with isActive: true will return null for inactive templates
      ;(prisma.formTemplate.findFirst as any).mockResolvedValue(null)

      const res = await formDetailModule.GET(makeRequest(), ctx)
      expect(res.status).toBe(404)
    })

    it('returns error when not authenticated', async () => {
      mockPatientAuth.requirePatientAuth.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        patient: null,
      })

      const res = await formDetailModule.GET(makeRequest(), ctx)
      expect(res.status).toBe(401)
    })
  })
})
