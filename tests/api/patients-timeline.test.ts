import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

// Import after mocking
const { GET } = await import('@/app/api/patients/[id]/timeline/route')

function makeRequest(id: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/patients/${id}/timeline`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return {
    req: new Request(url.toString()) as any,
    ctx: { params: Promise.resolve({ id }) },
  }
}

describe('GET /api/patients/[id]/timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'DOCTOR' } },
    })
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      hospitalId: null,
      session: null,
    })

    const { req, ctx } = makeRequest('patient-1')
    const res = await GET(req, ctx)
    expect(res.status).toBe(401)
  })

  it('returns 404 when patient not found', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue(null)

    const { req, ctx } = makeRequest('patient-missing')
    const res = await GET(req, ctx)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Patient not found')
  })

  it('returns aggregated timeline events sorted by date desc', async () => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 3600000)
    const twoDaysAgo = new Date(now.getTime() - 172800000)

    ;(prisma.patient.findFirst as any).mockResolvedValue({
      id: 'p1',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: twoDaysAgo,
    })

    // Appointments
    ;(prisma.appointment.findMany as any).mockResolvedValue([
      {
        id: 'apt-1',
        scheduledDate: now,
        appointmentType: 'CHECKUP',
        status: 'SCHEDULED',
        duration: 30,
        notes: null,
        doctor: { firstName: 'Jane', lastName: 'Smith' },
      },
    ])

    // Treatments
    ;(prisma.treatment.findMany as any).mockResolvedValue([
      {
        id: 'trt-1',
        createdAt: oneHourAgo,
        status: 'COMPLETED',
        toothNumbers: '16',
        cost: 500,
        diagnosis: 'Cavity',
        procedure: { name: 'Filling', category: 'RESTORATIVE' },
        doctor: { firstName: 'Jane', lastName: 'Smith' },
      },
    ])

    // Invoices with payments
    ;(prisma.invoice.findMany as any).mockResolvedValue([
      {
        id: 'inv-1',
        invoiceNo: 'INV001',
        totalAmount: 500,
        status: 'PAID',
        createdAt: oneHourAgo,
        payments: [
          {
            id: 'pay-1',
            amount: 500,
            paymentMethod: 'CASH',
            status: 'COMPLETED',
            paymentNo: 'PAY001',
            createdAt: oneHourAgo,
          },
        ],
      },
    ])

    // Documents, prescriptions, lab orders - empty
    ;(prisma.document.findMany as any).mockResolvedValue([])
    ;(prisma.prescription.findMany as any).mockResolvedValue([])
    ;(prisma.labOrder.findMany as any).mockResolvedValue([])

    const { req, ctx } = makeRequest('p1')
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.success).toBe(true)
    // 1 appointment + 1 treatment + 1 invoice + 1 payment + 1 registration = 5 events
    expect(body.total).toBe(5)
    expect(body.events.length).toBe(5)

    // First event should be the newest (appointment scheduled now)
    expect(body.events[0].type).toBe('appointment')
    expect(body.events[0].title).toContain('CHECKUP')
  })

  it('filters by type parameter', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({
      id: 'p1',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: new Date('2024-01-01'),
    })

    ;(prisma.treatment.findMany as any).mockResolvedValue([
      {
        id: 'trt-1',
        createdAt: new Date(),
        status: 'COMPLETED',
        toothNumbers: '16',
        cost: 500,
        diagnosis: 'Cavity',
        procedure: { name: 'Filling', category: 'RESTORATIVE' },
        doctor: { firstName: 'Jane', lastName: 'Smith' },
      },
    ])

    const { req, ctx } = makeRequest('p1', { type: 'treatment' })
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()

    // Only treatment events + registration event
    const treatmentEvents = body.events.filter((e: any) => e.type === 'treatment')
    expect(treatmentEvents.length).toBe(1)
    // Should NOT have called appointment/invoice/document/prescription/labOrder
    expect(prisma.appointment.findMany).not.toHaveBeenCalled()
    expect(prisma.invoice.findMany).not.toHaveBeenCalled()
  })

  it('applies pagination with limit and offset', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({
      id: 'p1',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: new Date('2024-01-01'),
    })

    // Create many appointments
    const appointments = Array.from({ length: 5 }, (_, i) => ({
      id: `apt-${i}`,
      scheduledDate: new Date(2024, 5, 10 - i),
      appointmentType: 'CHECKUP',
      status: 'COMPLETED',
      duration: 30,
      notes: null,
      doctor: null,
    }))
    ;(prisma.appointment.findMany as any).mockResolvedValue(appointments)
    ;(prisma.treatment.findMany as any).mockResolvedValue([])
    ;(prisma.invoice.findMany as any).mockResolvedValue([])
    ;(prisma.document.findMany as any).mockResolvedValue([])
    ;(prisma.prescription.findMany as any).mockResolvedValue([])
    ;(prisma.labOrder.findMany as any).mockResolvedValue([])

    const { req, ctx } = makeRequest('p1', { limit: '2', offset: '0' })
    const res = await GET(req, ctx)
    const body = await res.json()

    // 5 appointments + 1 registration = 6 total
    expect(body.total).toBe(6)
    expect(body.events.length).toBe(2)
    expect(body.hasMore).toBe(true)
  })

  it('includes document events', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({
      id: 'p1',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: new Date('2024-01-01'),
    })

    ;(prisma.document.findMany as any).mockResolvedValue([
      {
        id: 'doc-1',
        createdAt: new Date(),
        documentType: 'X_RAY',
        originalName: 'xray-tooth-16.jpg',
        fileSize: 1024,
      },
    ])

    const { req, ctx } = makeRequest('p1', { type: 'document' })
    const res = await GET(req, ctx)
    const body = await res.json()

    const docEvents = body.events.filter((e: any) => e.type === 'document')
    expect(docEvents.length).toBe(1)
    expect(docEvents[0].title).toContain('X')
    expect(docEvents[0].description).toBe('xray-tooth-16.jpg')
  })

  it('includes prescription events', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({
      id: 'p1',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: new Date('2024-01-01'),
    })

    ;(prisma.prescription.findMany as any).mockResolvedValue([
      {
        id: 'rx-1',
        createdAt: new Date(),
        prescriptionNo: 'RX001',
        diagnosis: 'Tooth infection',
        doctor: { firstName: 'Jane', lastName: 'Smith' },
      },
    ])

    const { req, ctx } = makeRequest('p1', { type: 'prescription' })
    const res = await GET(req, ctx)
    const body = await res.json()

    const rxEvents = body.events.filter((e: any) => e.type === 'prescription')
    expect(rxEvents.length).toBe(1)
    expect(rxEvents[0].title).toContain('RX001')
    expect(rxEvents[0].description).toContain('Dr. Jane Smith')
  })

  it('includes lab order events', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue({
      id: 'p1',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: new Date('2024-01-01'),
    })

    ;(prisma.labOrder.findMany as any).mockResolvedValue([
      {
        id: 'lab-1',
        createdAt: new Date(),
        workType: 'Crown',
        status: 'IN_PROGRESS',
        estimatedCost: 1500,
        labVendor: { name: 'DentLab Pro' },
      },
    ])

    const { req, ctx } = makeRequest('p1', { type: 'lab_order' })
    const res = await GET(req, ctx)
    const body = await res.json()

    const labEvents = body.events.filter((e: any) => e.type === 'lab_order')
    expect(labEvents.length).toBe(1)
    expect(labEvents[0].title).toContain('Crown')
    expect(labEvents[0].description).toBe('DentLab Pro')
  })
})
