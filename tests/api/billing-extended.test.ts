import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

// Mock auth
const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))
vi.mock('@/lib/api-helpers', () => mockAuth)

// Mock prisma
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

// Mock billing-utils
const { mockGeneratePaymentNo } = vi.hoisted(() => ({
  mockGeneratePaymentNo: vi.fn(),
}))
vi.mock('@/lib/billing-utils', () => ({
  generatePaymentNo: mockGeneratePaymentNo,
  getDateRangeFromPreset: vi.fn(() => ({
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31'),
  })),
}))

function makeRequest(url: string, options: any = {}) {
  return new Request(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
}

describe('GET/POST /api/invoices/[id]/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'ADMIN' } },
    })
  })

  it('GET returns invoice payments', async () => {
    const { GET } = await import('@/app/api/invoices/[id]/payments/route')

    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv1',
      invoiceNo: 'INV001',
      totalAmount: 10000,
      paidAmount: 5000,
      balanceAmount: 5000,
    } as any)
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: 'pay1', amount: 5000, paymentMethod: 'CASH' },
    ] as any)

    const req = makeRequest('http://localhost/api/invoices/inv1/payments')
    const res = await GET(req, { params: Promise.resolve({ id: 'inv1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.invoice.invoiceNo).toBe('INV001')
    expect(data.payments).toHaveLength(1)
  })

  it('GET returns 404 for missing invoice', async () => {
    const { GET } = await import('@/app/api/invoices/[id]/payments/route')

    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/invoices/x/payments')
    const res = await GET(req, { params: Promise.resolve({ id: 'x' }) })

    expect(res.status).toBe(404)
  })

  it('POST records a payment and updates invoice', async () => {
    const { POST } = await import('@/app/api/invoices/[id]/payments/route')

    vi.mocked(prisma.invoice.findUnique)
      .mockResolvedValueOnce({
        id: 'inv1',
        hospitalId: 'h1',
        status: 'PENDING',
        totalAmount: 10000,
        paidAmount: 0,
        balanceAmount: 10000,
      } as any)
      .mockResolvedValueOnce({
        id: 'inv1',
        status: 'PAID',
        patient: {},
        payments: [],
      } as any)

    mockGeneratePaymentNo.mockResolvedValue('PAY001')
    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay1',
      paymentNo: 'PAY001',
      amount: 10000,
    } as any)
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as any)

    const req = makeRequest('http://localhost/api/invoices/inv1/payments', {
      method: 'POST',
      body: { amount: 10000, paymentMethod: 'CASH' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'inv1' }) })
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.payment.paymentNo).toBe('PAY001')
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      })
    )
  })

  it('POST sets PARTIALLY_PAID when partial payment', async () => {
    const { POST } = await import('@/app/api/invoices/[id]/payments/route')

    vi.mocked(prisma.invoice.findUnique)
      .mockResolvedValueOnce({
        id: 'inv2',
        hospitalId: 'h1',
        status: 'PENDING',
        totalAmount: 10000,
        paidAmount: 0,
        balanceAmount: 10000,
      } as any)
      .mockResolvedValueOnce({ id: 'inv2' } as any)

    mockGeneratePaymentNo.mockResolvedValue('PAY002')
    vi.mocked(prisma.payment.create).mockResolvedValue({ id: 'pay2' } as any)
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as any)

    const req = makeRequest('http://localhost/api/invoices/inv2/payments', {
      method: 'POST',
      body: { amount: 3000, paymentMethod: 'UPI' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'inv2' }) })

    expect(res.status).toBe(201)
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PARTIALLY_PAID' }),
      })
    )
  })

  it('POST rejects payment exceeding balance', async () => {
    const { POST } = await import('@/app/api/invoices/[id]/payments/route')

    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv3',
      hospitalId: 'h1',
      status: 'PARTIALLY_PAID',
      totalAmount: 10000,
      paidAmount: 8000,
      balanceAmount: 2000,
    } as any)

    const req = makeRequest('http://localhost/api/invoices/inv3/payments', {
      method: 'POST',
      body: { amount: 5000, paymentMethod: 'CASH' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'inv3' }) })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('exceeds balance')
  })

  it('POST rejects payment on PAID invoice', async () => {
    const { POST } = await import('@/app/api/invoices/[id]/payments/route')

    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv4',
      hospitalId: 'h1',
      status: 'PAID',
      totalAmount: 10000,
      paidAmount: 10000,
      balanceAmount: 0,
    } as any)

    const req = makeRequest('http://localhost/api/invoices/inv4/payments', {
      method: 'POST',
      body: { amount: 1000, paymentMethod: 'CASH' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'inv4' }) })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('already fully paid')
  })

  it('POST rejects payment on CANCELLED invoice', async () => {
    const { POST } = await import('@/app/api/invoices/[id]/payments/route')

    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv5',
      hospitalId: 'h1',
      status: 'CANCELLED',
    } as any)

    const req = makeRequest('http://localhost/api/invoices/inv5/payments', {
      method: 'POST',
      body: { amount: 1000, paymentMethod: 'CASH' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'inv5' }) })

    expect(res.status).toBe(400)
  })

  it('POST returns 400 if amount missing or zero', async () => {
    const { POST } = await import('@/app/api/invoices/[id]/payments/route')

    const req = makeRequest('http://localhost/api/invoices/inv1/payments', {
      method: 'POST',
      body: { amount: 0, paymentMethod: 'CASH' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'inv1' }) })

    expect(res.status).toBe(400)
  })

  it('POST returns 400 if paymentMethod missing', async () => {
    const { POST } = await import('@/app/api/invoices/[id]/payments/route')

    const req = makeRequest('http://localhost/api/invoices/inv1/payments', {
      method: 'POST',
      body: { amount: 1000 },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'inv1' }) })

    expect(res.status).toBe(400)
  })

  it('POST returns 403 for unauthorized role', async () => {
    const { POST } = await import('@/app/api/invoices/[id]/payments/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'DOCTOR' } },
    })

    const req = makeRequest('http://localhost/api/invoices/inv1/payments', {
      method: 'POST',
      body: { amount: 1000, paymentMethod: 'CASH' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'inv1' }) })

    expect(res.status).toBe(403)
  })
})

describe('GET /api/billing/unbilled-treatments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'ADMIN' } },
    })
  })

  it('returns unbilled treatments for a patient', async () => {
    const { GET } = await import('@/app/api/billing/unbilled-treatments/route')

    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      id: 'p1',
      patientId: 'PID001',
      firstName: 'John',
      lastName: 'Doe',
    } as any)
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([
      {
        id: 't1',
        treatmentNo: 'TRT001',
        cost: 5000,
        toothNumbers: '11',
        endTime: new Date(),
        procedure: { id: 'proc1', code: 'RCT', name: 'Root Canal', category: 'Endodontics', basePrice: 5000 },
        doctor: { id: 'd1', firstName: 'Dr', lastName: 'Smith' },
      },
    ] as any)

    const req = makeRequest('http://localhost/api/billing/unbilled-treatments?patientId=p1')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.patient.firstName).toBe('John')
    expect(data.treatments).toHaveLength(1)
    expect(data.treatments[0].unitPrice).toBe(5000)
    expect(data.summary.totalTreatments).toBe(1)
    expect(data.summary.totalUnbilled).toBe(5000)
  })

  it('returns 400 if patientId missing', async () => {
    const { GET } = await import('@/app/api/billing/unbilled-treatments/route')

    const req = makeRequest('http://localhost/api/billing/unbilled-treatments')
    const res = await GET(req)

    expect(res.status).toBe(400)
  })

  it('returns 404 if patient not found', async () => {
    const { GET } = await import('@/app/api/billing/unbilled-treatments/route')

    vi.mocked(prisma.patient.findUnique).mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/billing/unbilled-treatments?patientId=bad')
    const res = await GET(req)

    expect(res.status).toBe(404)
  })
})

describe('GET /api/billing/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'ADMIN' } },
    })
  })

  it('returns summary report with breakdowns', async () => {
    const { GET } = await import('@/app/api/billing/reports/route')

    vi.mocked(prisma.invoice.aggregate).mockResolvedValueOnce({
      _sum: { totalAmount: 100000, discountAmount: 5000 },
      _count: 20,
    } as any)
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amount: 80000 },
      _count: 15,
    } as any)
    vi.mocked(prisma.invoice.aggregate).mockResolvedValueOnce({
      _sum: { balanceAmount: 20000 },
      _count: 5,
    } as any)
    vi.mocked(prisma.insuranceClaim.aggregate).mockResolvedValue({
      _sum: { claimAmount: 30000, settledAmount: 25000 },
      _count: 3,
    } as any)
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { paymentMethod: 'CASH', _sum: { amount: 50000 }, _count: 10 },
    ] as any)
    vi.mocked(prisma.invoice.groupBy).mockResolvedValue([
      { status: 'PAID', _sum: { totalAmount: 80000 }, _count: 15 },
    ] as any)

    const req = makeRequest('http://localhost/api/billing/reports?type=summary')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.summary).toBeDefined()
    expect(data.breakdowns).toBeDefined()
  })

  it('returns revenue report with daily data', async () => {
    const { GET } = await import('@/app/api/billing/reports/route')

    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      {
        createdAt: new Date('2026-01-15'),
        totalAmount: 5000,
        paidAmount: 5000,
        discountAmount: 0,
        cgstAmount: 450,
        sgstAmount: 450,
      },
    ] as any)

    const req = makeRequest('http://localhost/api/billing/reports?type=revenue&dateFrom=2026-01-01&dateTo=2026-01-31')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.dailyData).toBeDefined()
    expect(data.totals).toBeDefined()
  })

  it('returns outstanding report with aging buckets', async () => {
    const { GET } = await import('@/app/api/billing/reports/route')

    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      {
        id: 'inv1',
        balanceAmount: 5000,
        dueDate: new Date(),
        createdAt: new Date(),
        patient: { id: 'p1', firstName: 'John', lastName: 'Doe' },
      },
    ] as any)

    const req = makeRequest('http://localhost/api/billing/reports?type=outstanding')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.aging).toBeDefined()
    expect(data.totals.totalOutstanding).toBe(5000)
  })

  it('returns payments report', async () => {
    const { GET } = await import('@/app/api/billing/reports/route')

    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay1',
        amount: 5000,
        paymentMethod: 'CASH',
        paymentDate: new Date('2026-01-15'),
        invoice: { invoiceNo: 'INV001', patient: { firstName: 'John', lastName: 'Doe' } },
      },
    ] as any)

    const req = makeRequest('http://localhost/api/billing/reports?type=payments')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.payments).toHaveLength(1)
    expect(data.byMethod).toBeDefined()
  })

  it('returns procedure_revenue report', async () => {
    const { GET } = await import('@/app/api/billing/reports/route')

    vi.mocked(prisma.treatment.findMany).mockResolvedValue([
      {
        cost: 5000,
        procedure: { id: 'proc1', code: 'RCT', name: 'Root Canal', category: 'Endodontics' },
      },
    ] as any)

    const req = makeRequest('http://localhost/api/billing/reports?type=procedure_revenue')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.byProcedure).toBeDefined()
    expect(data.byCategory).toBeDefined()
  })

  it('returns doctor_revenue report', async () => {
    const { GET } = await import('@/app/api/billing/reports/route')

    vi.mocked(prisma.treatment.findMany).mockResolvedValue([
      {
        cost: 8000,
        doctor: { id: 'd1', firstName: 'John', lastName: 'Smith', specialization: 'Ortho' },
        procedure: { name: 'Braces', category: 'Ortho' },
      },
    ] as any)

    const req = makeRequest('http://localhost/api/billing/reports?type=doctor_revenue')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.byDoctor).toBeDefined()
    expect(data.byDoctor[0].name).toBe('John Smith')
  })

  it('returns daily_collection report', async () => {
    const { GET } = await import('@/app/api/billing/reports/route')

    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        amount: 5000,
        paymentMethod: 'CASH',
        paymentDate: new Date('2026-01-15'),
        paymentNo: 'PAY001',
        invoice: {
          invoiceNo: 'INV001',
          patient: { patientId: 'PID1', firstName: 'John', lastName: 'Doe' },
        },
      },
    ] as any)

    const req = makeRequest('http://localhost/api/billing/reports?type=daily_collection')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.dailyData).toBeDefined()
    expect(data.totals.totalCollection).toBe(5000)
  })

  it('returns 400 for invalid report type', async () => {
    const { GET } = await import('@/app/api/billing/reports/route')

    const req = makeRequest('http://localhost/api/billing/reports?type=invalid')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Invalid report type')
  })

  it('returns 403 for non-ADMIN/ACCOUNTANT', async () => {
    const { GET } = await import('@/app/api/billing/reports/route')

    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { role: 'DOCTOR' } },
    })

    const req = makeRequest('http://localhost/api/billing/reports?type=summary')
    const res = await GET(req)

    expect(res.status).toBe(403)
  })
})
