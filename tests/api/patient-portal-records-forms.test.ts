// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

const { mockRequirePatientAuth } = vi.hoisted(() => ({
  mockRequirePatientAuth: vi.fn(),
}))

vi.mock('@/lib/patient-auth', () => ({
  requirePatientAuth: mockRequirePatientAuth,
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { GET as recordsGET } from '@/app/api/patient-portal/records/route'
import {
  GET as formsGET,
  POST as formsPOST,
} from '@/app/api/patient-portal/forms/route'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockPatientAuth() {
  mockRequirePatientAuth.mockResolvedValue({
    error: null,
    patient: { id: 'pat1', hospitalId: 'h1', firstName: 'John', lastName: 'Doe' },
  })
}

function mockPatientAuthError() {
  mockRequirePatientAuth.mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    patient: null,
  })
}

function makeReq(path: string, method = 'GET', body?: any): NextRequest {
  const url = `http://localhost${path}`
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init)
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/patient-portal/records — treatments tab
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/patient-portal/records', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockPatientAuthError()
    const res = await recordsGET(makeReq('/api/patient-portal/records'))
    expect(res.status).toBe(401)
  })

  it('returns treatments by default', async () => {
    mockPatientAuth()
    const mockTreatments = [
      {
        id: 't1', status: 'COMPLETED',
        procedure: { name: 'Cleaning', code: 'D0100', category: 'PREVENTIVE' },
        doctor: { firstName: 'Dr.', lastName: 'Smith' },
      },
    ]
    vi.mocked(prisma.treatment.findMany).mockResolvedValue(mockTreatments as any)

    const res = await recordsGET(makeReq('/api/patient-portal/records'))
    const body = await res.json()

    expect(body.treatments).toHaveLength(1)
    expect(body.treatments[0].procedure.name).toBe('Cleaning')
  })

  it('returns treatments when tab=treatments', async () => {
    mockPatientAuth()
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])

    const res = await recordsGET(makeReq('/api/patient-portal/records?tab=treatments'))
    const body = await res.json()

    expect(body.treatments).toBeDefined()
    expect(prisma.treatment.findMany).toHaveBeenCalled()
  })

  it('returns chart entries when tab=chart', async () => {
    mockPatientAuth()
    vi.mocked(prisma.dentalChartEntry.findMany).mockResolvedValue([
      { id: 'ce1', toothNumber: 11, condition: 'CAVITY' },
    ] as any)

    const res = await recordsGET(makeReq('/api/patient-portal/records?tab=chart'))
    const body = await res.json()

    expect(body.chartEntries).toHaveLength(1)
    expect(body.chartEntries[0].toothNumber).toBe(11)
  })

  it('returns documents when tab=documents', async () => {
    mockPatientAuth()
    vi.mocked(prisma.document.findMany).mockResolvedValue([
      { id: 'd1', fileName: 'xray.jpg', fileType: 'image/jpeg', fileSize: 1024 },
    ] as any)

    const res = await recordsGET(makeReq('/api/patient-portal/records?tab=documents'))
    const body = await res.json()

    expect(body.documents).toHaveLength(1)
    expect(body.documents[0].fileName).toBe('xray.jpg')
  })

  it('returns 400 for invalid tab', async () => {
    mockPatientAuth()
    const res = await recordsGET(makeReq('/api/patient-portal/records?tab=invalid'))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid tab')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET /api/patient-portal/forms
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/patient-portal/forms', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockPatientAuthError()
    const res = await formsGET(makeReq('/api/patient-portal/forms'))
    expect(res.status).toBe(401)
  })

  it('returns submissions and available templates', async () => {
    mockPatientAuth()
    vi.mocked(prisma.formSubmission.findMany).mockResolvedValue([
      {
        id: 'fs1', data: { field1: 'value1' },
        template: { id: 'ft1', name: 'Consent Form', type: 'CONSENT', description: 'General consent' },
      },
    ] as any)
    vi.mocked(prisma.formTemplate.findMany).mockResolvedValue([
      { id: 'ft1', name: 'Consent Form', type: 'CONSENT', description: 'General consent' },
      { id: 'ft2', name: 'Medical History', type: 'INTAKE', description: 'Medical history form' },
    ] as any)

    const res = await formsGET(makeReq('/api/patient-portal/forms'))
    const body = await res.json()

    expect(body.submissions).toHaveLength(1)
    expect(body.availableTemplates).toHaveLength(2)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. POST /api/patient-portal/forms
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/patient-portal/forms', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockPatientAuthError()
    const res = await formsPOST(makeReq('/api/patient-portal/forms', 'POST', { templateId: 'ft1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when templateId is missing', async () => {
    mockPatientAuth()
    const res = await formsPOST(makeReq('/api/patient-portal/forms', 'POST', {}))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('templateId')
  })

  it('returns 404 when template not found', async () => {
    mockPatientAuth()
    vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue(null)
    const res = await formsPOST(makeReq('/api/patient-portal/forms', 'POST', { templateId: 'ft999' }))
    expect(res.status).toBe(404)
  })

  it('creates a form submission', async () => {
    mockPatientAuth()
    vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue({
      id: 'ft1', hospitalId: 'h1', isActive: true,
    } as any)
    vi.mocked(prisma.formSubmission.create).mockResolvedValue({
      id: 'fs1', templateId: 'ft1', patientId: 'pat1', data: { q1: 'yes' },
    } as any)

    const res = await formsPOST(makeReq('/api/patient-portal/forms', 'POST', {
      templateId: 'ft1',
      data: { q1: 'yes' },
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.submission.templateId).toBe('ft1')
  })

  it('creates submission with signature and sets signedAt', async () => {
    mockPatientAuth()
    vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue({
      id: 'ft1', hospitalId: 'h1', isActive: true,
    } as any)
    vi.mocked(prisma.formSubmission.create).mockResolvedValue({
      id: 'fs1', templateId: 'ft1', signature: 'base64sig', signedAt: new Date(),
    } as any)

    await formsPOST(makeReq('/api/patient-portal/forms', 'POST', {
      templateId: 'ft1',
      data: { q1: 'yes' },
      signature: 'base64sig',
    }))

    const createCall = vi.mocked(prisma.formSubmission.create).mock.calls[0][0]
    expect(createCall.data.signature).toBe('base64sig')
    expect(createCall.data.signedAt).toBeInstanceOf(Date)
  })

  it('records IP address', async () => {
    mockPatientAuth()
    vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue({
      id: 'ft1', hospitalId: 'h1', isActive: true,
    } as any)
    vi.mocked(prisma.formSubmission.create).mockResolvedValue({ id: 'fs1' } as any)

    const req = makeReq('/api/patient-portal/forms', 'POST', {
      templateId: 'ft1', data: {},
    })

    await formsPOST(req)

    const createCall = vi.mocked(prisma.formSubmission.create).mock.calls[0][0]
    expect(createCall.data.ipAddress).toBeDefined()
  })

  it('includes appointmentId when provided', async () => {
    mockPatientAuth()
    vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue({
      id: 'ft1', hospitalId: 'h1', isActive: true,
    } as any)
    vi.mocked(prisma.formSubmission.create).mockResolvedValue({ id: 'fs1' } as any)

    await formsPOST(makeReq('/api/patient-portal/forms', 'POST', {
      templateId: 'ft1', data: {}, appointmentId: 'apt1',
    }))

    const createCall = vi.mocked(prisma.formSubmission.create).mock.calls[0][0]
    expect(createCall.data.appointmentId).toBe('apt1')
  })
})
