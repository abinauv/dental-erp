// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as formsGET, POST as formsPOST } from '@/app/api/forms/route'
import { GET as formByIdGET, PUT as formByIdPUT } from '@/app/api/forms/[id]/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Auth helpers ─────────────────────────────────────────────────────────────

function mockAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
    hospitalId: 'h1',
  }
  vi.mocked(requireAuthAndRole).mockResolvedValue({ ...defaults, ...overrides } as any)
}

function mockAuthError() {
  vi.mocked(requireAuthAndRole).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  } as any)
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
// 1. GET/POST /api/forms
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/forms', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await formsGET(makeReq('/api/forms'))
    expect(res.status).toBe(401)
  })

  it('returns form submissions with pagination', async () => {
    mockAuth()
    vi.mocked(prisma.formSubmission.findMany).mockResolvedValue([
      { id: 'fs1', templateId: 't1', status: 'SUBMITTED', template: { name: 'Consent', type: 'CONSENT' } },
      { id: 'fs2', templateId: 't2', status: 'REVIEWED', template: { name: 'Intake', type: 'INTAKE' } },
    ] as any)
    vi.mocked(prisma.formSubmission.count).mockResolvedValue(2)

    const res = await formsGET(makeReq('/api/forms'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.submissions).toHaveLength(2)
    expect(body.total).toBe(2)
  })

  it('filters by patientId and status', async () => {
    mockAuth()
    vi.mocked(prisma.formSubmission.findMany).mockResolvedValue([])
    vi.mocked(prisma.formSubmission.count).mockResolvedValue(0)

    await formsGET(makeReq('/api/forms?patientId=p1&status=SUBMITTED'))

    expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: 'p1',
          status: 'SUBMITTED',
        }),
      })
    )
  })

  it('filters by templateId and appointmentId', async () => {
    mockAuth()
    vi.mocked(prisma.formSubmission.findMany).mockResolvedValue([])
    vi.mocked(prisma.formSubmission.count).mockResolvedValue(0)

    await formsGET(makeReq('/api/forms?templateId=t1&appointmentId=a1'))

    expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          templateId: 't1',
          appointmentId: 'a1',
        }),
      })
    )
  })
})

describe('POST /api/forms', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await formsPOST(makeReq('/api/forms', 'POST', { templateId: 't1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when templateId missing', async () => {
    mockAuth()
    const res = await formsPOST(makeReq('/api/forms', 'POST', {}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('templateId')
  })

  it('returns 404 when template not found', async () => {
    mockAuth()
    vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue(null)

    const res = await formsPOST(makeReq('/api/forms', 'POST', { templateId: 't-nonexistent' }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toContain('Template not found')
  })

  it('creates form submission successfully', async () => {
    mockAuth()
    vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue({ id: 't1', hospitalId: 'h1' } as any)
    vi.mocked(prisma.formSubmission.create).mockResolvedValue({
      id: 'fs1', templateId: 't1', hospitalId: 'h1', patientId: 'p1', data: { field1: 'value1' },
    } as any)

    const res = await formsPOST(makeReq('/api/forms', 'POST', {
      templateId: 't1',
      patientId: 'p1',
      data: { field1: 'value1' },
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.submission.templateId).toBe('t1')
  })

  it('creates submission with signature and signedAt', async () => {
    mockAuth()
    vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue({ id: 't1' } as any)
    vi.mocked(prisma.formSubmission.create).mockResolvedValue({
      id: 'fs1', signature: 'sig_data', signedAt: new Date(),
    } as any)

    await formsPOST(makeReq('/api/forms', 'POST', {
      templateId: 't1',
      signature: 'sig_data',
    }))

    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signature: 'sig_data',
          signedAt: expect.any(Date),
        }),
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET/PUT /api/forms/[id]
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/forms/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await formByIdGET(makeReq('/api/forms/fs1'), { params: Promise.resolve({ id: 'fs1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when submission not found', async () => {
    mockAuth()
    vi.mocked(prisma.formSubmission.findFirst).mockResolvedValue(null)

    const res = await formByIdGET(makeReq('/api/forms/fs-none'), { params: Promise.resolve({ id: 'fs-none' }) })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toContain('not found')
  })

  it('returns submission with template', async () => {
    mockAuth()
    vi.mocked(prisma.formSubmission.findFirst).mockResolvedValue({
      id: 'fs1', templateId: 't1', data: { field1: 'value1' },
      template: { id: 't1', name: 'Consent Form', fields: [] },
    } as any)

    const res = await formByIdGET(makeReq('/api/forms/fs1'), { params: Promise.resolve({ id: 'fs1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.submission.template.name).toBe('Consent Form')
  })
})

describe('PUT /api/forms/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await formByIdPUT(
      makeReq('/api/forms/fs1', 'PUT', { status: 'APPROVED' }),
      { params: Promise.resolve({ id: 'fs1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 when submission not found', async () => {
    mockAuth()
    vi.mocked(prisma.formSubmission.findFirst).mockResolvedValue(null)

    const res = await formByIdPUT(
      makeReq('/api/forms/fs-none', 'PUT', { status: 'APPROVED' }),
      { params: Promise.resolve({ id: 'fs-none' }) }
    )

    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid status', async () => {
    mockAuth()
    vi.mocked(prisma.formSubmission.findFirst).mockResolvedValue({ id: 'fs1' } as any)

    const res = await formByIdPUT(
      makeReq('/api/forms/fs1', 'PUT', { status: 'INVALID' }),
      { params: Promise.resolve({ id: 'fs1' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid status')
  })

  it('reviews/approves submission', async () => {
    mockAuth()
    vi.mocked(prisma.formSubmission.findFirst).mockResolvedValue({ id: 'fs1' } as any)
    vi.mocked(prisma.formSubmission.update).mockResolvedValue({
      id: 'fs1', status: 'APPROVED', reviewedBy: 'u1', reviewedAt: new Date(),
    } as any)

    const res = await formByIdPUT(
      makeReq('/api/forms/fs1', 'PUT', { status: 'APPROVED', reviewNotes: 'Looks good' }),
      { params: Promise.resolve({ id: 'fs1' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.submission.status).toBe('APPROVED')
    expect(prisma.formSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewedBy: 'u1',
          reviewNotes: 'Looks good',
        }),
      })
    )
  })

  it('rejects submission with notes', async () => {
    mockAuth()
    vi.mocked(prisma.formSubmission.findFirst).mockResolvedValue({ id: 'fs1' } as any)
    vi.mocked(prisma.formSubmission.update).mockResolvedValue({
      id: 'fs1', status: 'REJECTED', reviewNotes: 'Missing info',
    } as any)

    const res = await formByIdPUT(
      makeReq('/api/forms/fs1', 'PUT', { status: 'REJECTED', reviewNotes: 'Missing info' }),
      { params: Promise.resolve({ id: 'fs1' }) }
    )
    const body = await res.json()

    expect(body.submission.status).toBe('REJECTED')
  })
})
