import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

// Mock auth
const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))
vi.mock('@/lib/api-helpers', () => mockAuth)

// Mock prisma
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

function makeRequest(url: string, options: any = {}) {
  return new Request(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
}

describe('POST /api/treatments/[id]/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'DOCTOR' } },
    })
  })

  it('starts a PLANNED treatment', async () => {
    const { POST } = await import('@/app/api/treatments/[id]/start/route')

    vi.mocked(prisma.treatment.findUnique).mockResolvedValue({
      id: 't1',
      hospitalId: 'h1',
      status: 'PLANNED',
    } as any)
    vi.mocked(prisma.treatment.update).mockResolvedValue({
      id: 't1',
      status: 'IN_PROGRESS',
      patient: { id: 'p1' },
      doctor: { id: 'd1' },
      procedure: { id: 'proc1' },
    } as any)

    const req = makeRequest('http://localhost/api/treatments/t1/start', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 't1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe('IN_PROGRESS')
    expect(prisma.treatment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      })
    )
  })

  it('rejects start for non-PLANNED treatment', async () => {
    const { POST } = await import('@/app/api/treatments/[id]/start/route')

    vi.mocked(prisma.treatment.findUnique).mockResolvedValue({
      id: 't2',
      hospitalId: 'h1',
      status: 'COMPLETED',
    } as any)

    const req = makeRequest('http://localhost/api/treatments/t2/start', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 't2' }) })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Cannot start')
  })

  it('returns 404 for missing treatment', async () => {
    const { POST } = await import('@/app/api/treatments/[id]/start/route')

    vi.mocked(prisma.treatment.findUnique).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/treatments/x/start', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'x' }) })

    expect(res.status).toBe(404)
  })

  it('returns 403 for STAFF role', async () => {
    const { POST } = await import('@/app/api/treatments/[id]/start/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'STAFF' } },
    })

    const req = makeRequest('http://localhost/api/treatments/t1/start', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 't1' }) })

    expect(res.status).toBe(403)
  })
})

describe('POST /api/treatments/[id]/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'DOCTOR' } },
    })
  })

  it('completes an IN_PROGRESS treatment', async () => {
    const { POST } = await import('@/app/api/treatments/[id]/complete/route')

    vi.mocked(prisma.treatment.findUnique).mockResolvedValue({
      id: 't1',
      hospitalId: 'h1',
      status: 'IN_PROGRESS',
      startTime: new Date(),
    } as any)
    vi.mocked(prisma.treatment.update).mockResolvedValue({
      id: 't1',
      status: 'COMPLETED',
      patient: {},
      doctor: {},
      procedure: {},
    } as any)

    const req = makeRequest('http://localhost/api/treatments/t1/complete', {
      method: 'POST',
      body: { procedureNotes: 'Went well', followUpRequired: true },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 't1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe('COMPLETED')
  })

  it('completes a PLANNED treatment (sets startTime)', async () => {
    const { POST } = await import('@/app/api/treatments/[id]/complete/route')

    vi.mocked(prisma.treatment.findUnique).mockResolvedValue({
      id: 't2',
      hospitalId: 'h1',
      status: 'PLANNED',
      startTime: null,
    } as any)
    vi.mocked(prisma.treatment.update).mockResolvedValue({ status: 'COMPLETED' } as any)

    const req = makeRequest('http://localhost/api/treatments/t2/complete', {
      method: 'POST',
      body: {},
    })
    const res = await POST(req, { params: Promise.resolve({ id: 't2' }) })

    expect(res.status).toBe(200)
    expect(prisma.treatment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          startTime: expect.any(Date),
        }),
      })
    )
  })

  it('rejects completion for COMPLETED treatment', async () => {
    const { POST } = await import('@/app/api/treatments/[id]/complete/route')

    vi.mocked(prisma.treatment.findUnique).mockResolvedValue({
      id: 't3',
      hospitalId: 'h1',
      status: 'COMPLETED',
    } as any)

    const req = makeRequest('http://localhost/api/treatments/t3/complete', {
      method: 'POST',
      body: {},
    })
    const res = await POST(req, { params: Promise.resolve({ id: 't3' }) })

    expect(res.status).toBe(400)
  })

  it('returns 403 for non-DOCTOR/ADMIN', async () => {
    const { POST } = await import('@/app/api/treatments/[id]/complete/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'RECEPTIONIST' } },
    })

    const req = makeRequest('http://localhost/api/treatments/t1/complete', {
      method: 'POST',
      body: {},
    })
    const res = await POST(req, { params: Promise.resolve({ id: 't1' }) })

    expect(res.status).toBe(403)
  })

  it('returns 404 for missing treatment', async () => {
    const { POST } = await import('@/app/api/treatments/[id]/complete/route')

    vi.mocked(prisma.treatment.findUnique).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/treatments/x/complete', {
      method: 'POST',
      body: {},
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'x' }) })

    expect(res.status).toBe(404)
  })
})

describe('GET/POST /api/treatment-plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'DOCTOR' } },
    })
  })

  it('GET returns paginated treatment plans', async () => {
    const { GET } = await import('@/app/api/treatment-plans/route')

    const plans = [
      { id: 'tp1', planNumber: 'PLN2026010001', title: 'Root Canal Plan', patient: {}, items: [], _count: { items: 2 } },
    ]
    vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue(plans as any)
    vi.mocked(prisma.treatmentPlan.count).mockResolvedValue(1)

    const req = makeRequest('http://localhost/api/treatment-plans?page=1&limit=10')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.treatmentPlans).toHaveLength(1)
    expect(data.pagination.total).toBe(1)
  })

  it('GET filters by search, status, patientId', async () => {
    const { GET } = await import('@/app/api/treatment-plans/route')

    vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatmentPlan.count).mockResolvedValue(0)

    const req = makeRequest('http://localhost/api/treatment-plans?search=root&status=DRAFT&patientId=p1')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(prisma.treatmentPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'DRAFT',
          patientId: 'p1',
          OR: expect.any(Array),
        }),
      })
    )
  })

  it('POST creates a treatment plan with items', async () => {
    const { POST } = await import('@/app/api/treatment-plans/route')

    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([
      { id: 'proc1', basePrice: 5000, defaultDuration: 60 },
    ] as any)
    vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue(null) // for generatePlanNumber
    vi.mocked(prisma.treatmentPlan.create).mockResolvedValue({
      id: 'tp1',
      planNumber: 'PLN2026020001',
      status: 'DRAFT',
      patient: {},
      items: [],
    } as any)

    const req = makeRequest('http://localhost/api/treatment-plans', {
      method: 'POST',
      body: {
        patientId: 'p1',
        title: 'Full Treatment',
        items: [{ procedureId: 'proc1', toothNumbers: '11,12' }],
      },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(prisma.treatmentPlan.create).toHaveBeenCalled()
  })

  it('POST returns 400 if title missing', async () => {
    const { POST } = await import('@/app/api/treatment-plans/route')

    const req = makeRequest('http://localhost/api/treatment-plans', {
      method: 'POST',
      body: { patientId: 'p1' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('POST returns 404 if patient not found', async () => {
    const { POST } = await import('@/app/api/treatment-plans/route')

    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/treatment-plans', {
      method: 'POST',
      body: { patientId: 'bad', title: 'Plan' },
    })
    const res = await POST(req)

    expect(res.status).toBe(404)
  })

  it('POST returns 403 for non-DOCTOR/ADMIN', async () => {
    const { POST } = await import('@/app/api/treatment-plans/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'RECEPTIONIST' } },
    })

    const req = makeRequest('http://localhost/api/treatment-plans', {
      method: 'POST',
      body: { patientId: 'p1', title: 'Plan' },
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
  })
})

describe('GET/PUT/DELETE /api/treatment-plans/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'DOCTOR' } },
    })
  })

  it('GET returns treatment plan detail', async () => {
    const { GET } = await import('@/app/api/treatment-plans/[id]/route')

    vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue({
      id: 'tp1',
      planNumber: 'PLN001',
      patient: {},
      items: [],
    } as any)

    const req = makeRequest('http://localhost/api/treatment-plans/tp1')
    const res = await GET(req, { params: Promise.resolve({ id: 'tp1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBe('tp1')
  })

  it('GET returns 404 for missing plan', async () => {
    const { GET } = await import('@/app/api/treatment-plans/[id]/route')

    vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/treatment-plans/x')
    const res = await GET(req, { params: Promise.resolve({ id: 'x' }) })

    expect(res.status).toBe(404)
  })

  it('PUT updates treatment plan fields', async () => {
    const { PUT } = await import('@/app/api/treatment-plans/[id]/route')

    vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue({
      id: 'tp1',
      status: 'DRAFT',
      items: [],
    } as any)
    vi.mocked(prisma.treatmentPlan.update).mockResolvedValue({
      id: 'tp1',
      title: 'Updated',
      patient: {},
      items: [],
    } as any)

    const req = makeRequest('http://localhost/api/treatment-plans/tp1', {
      method: 'PUT',
      body: { title: 'Updated', notes: 'New notes' },
    })
    const res = await PUT(req, { params: Promise.resolve({ id: 'tp1' }) })

    expect(res.status).toBe(200)
  })

  it('PUT rejects modification of COMPLETED plan for non-admin', async () => {
    const { PUT } = await import('@/app/api/treatment-plans/[id]/route')

    vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue({
      id: 'tp2',
      status: 'COMPLETED',
      items: [],
    } as any)

    const req = makeRequest('http://localhost/api/treatment-plans/tp2', {
      method: 'PUT',
      body: { title: 'Try update' },
    })
    const res = await PUT(req, { params: Promise.resolve({ id: 'tp2' }) })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Cannot modify')
  })

  it('PUT returns 403 for non-DOCTOR/ADMIN', async () => {
    const { PUT } = await import('@/app/api/treatment-plans/[id]/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'STAFF' } },
    })

    const req = makeRequest('http://localhost/api/treatment-plans/tp1', {
      method: 'PUT',
      body: { title: 'Updated' },
    })
    const res = await PUT(req, { params: Promise.resolve({ id: 'tp1' }) })

    expect(res.status).toBe(403)
  })

  it('DELETE removes plan with no active items (ADMIN only)', async () => {
    const { DELETE } = await import('@/app/api/treatment-plans/[id]/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'ADMIN' } },
    })

    vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue({
      id: 'tp1',
      items: [{ status: 'PENDING' }],
    } as any)
    vi.mocked(prisma.treatmentPlanItem.deleteMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.treatmentPlan.delete).mockResolvedValue({} as any)

    const req = makeRequest('http://localhost/api/treatment-plans/tp1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'tp1' }) })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.message).toContain('deleted')
  })

  it('DELETE rejects plan with active items', async () => {
    const { DELETE } = await import('@/app/api/treatment-plans/[id]/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'ADMIN' } },
    })

    vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue({
      id: 'tp2',
      items: [{ status: 'IN_PROGRESS' }],
    } as any)

    const req = makeRequest('http://localhost/api/treatment-plans/tp2', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'tp2' }) })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('active or completed')
  })

  it('DELETE returns 403 for non-admin', async () => {
    const { DELETE } = await import('@/app/api/treatment-plans/[id]/route')

    const req = makeRequest('http://localhost/api/treatment-plans/tp1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'tp1' }) })

    expect(res.status).toBe(403)
  })
})
