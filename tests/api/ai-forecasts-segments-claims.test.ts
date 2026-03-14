import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockOpenRouter = vi.hoisted(() => ({
  complete: vi.fn(),
  extractJSON: vi.fn((s: string) => s),
}))

const mockModels = vi.hoisted(() => ({
  getModelByTier: vi.fn(() => ({ model: 'test-model', maxTokens: 4096 })),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/ai/openrouter', () => mockOpenRouter)
vi.mock('@/lib/ai/models', () => mockModels)

const inventoryForecastModule = await import('@/app/api/ai/inventory-forecast/route')
const cashflowModule = await import('@/app/api/ai/cashflow-forecast/route')
const segmentsModule = await import('@/app/api/ai/patient-segments/route')
const claimModule = await import('@/app/api/ai/claim-analysis/route')

function makeRequest(body?: any) {
  return new Request('http://localhost/api/ai/claim-analysis', {
    method: 'POST',
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

describe('GET /api/ai/inventory-forecast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('returns empty forecasts when no inventory items', async () => {
    ;(prisma.inventoryItem.findMany as any).mockResolvedValue([])
    const req = new Request('http://localhost/api/ai/inventory-forecast') as any
    const res = await inventoryForecastModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.forecasts).toEqual([])
    expect(body.summary.criticalItems).toBe(0)
  })

  it('generates forecast with AI and returns model info', async () => {
    ;(prisma.inventoryItem.findMany as any).mockResolvedValue([
      { id: 'item-1', name: 'Gloves', sku: 'GLV001', currentStock: 100, minimumStock: 20, reorderLevel: 30, unit: 'box', purchasePrice: 500 },
    ])
    ;(prisma.stockTransaction.findMany as any).mockResolvedValue([
      { itemId: 'item-1', quantity: 10, type: 'CONSUMPTION', createdAt: new Date('2026-01-15') },
      { itemId: 'item-1', quantity: 8, type: 'SALE', createdAt: new Date('2026-02-10') },
    ])

    const aiResult = {
      forecasts: [{ itemId: 'item-1', itemName: 'Gloves', urgency: 'NORMAL', daysUntilStockout: 50 }],
      summary: { criticalItems: 0, reorderItems: 0, excessItems: 1, totalReorderValue: 0 },
    }
    mockOpenRouter.complete.mockResolvedValue({ content: JSON.stringify(aiResult), model: 'test-model' })
    mockOpenRouter.extractJSON.mockReturnValue(JSON.stringify(aiResult))

    const req = new Request('http://localhost/api/ai/inventory-forecast') as any
    const res = await inventoryForecastModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.forecasts).toHaveLength(1)
    expect(body.model).toBe('test-model')
  })

  it('falls back to rule-based forecast when AI parsing fails', async () => {
    ;(prisma.inventoryItem.findMany as any).mockResolvedValue([
      { id: 'item-1', name: 'Gloves', sku: 'GLV001', currentStock: 100, minimumStock: 20, reorderLevel: 30, unit: 'box', purchasePrice: 500 },
    ])
    ;(prisma.stockTransaction.findMany as any).mockResolvedValue([])
    mockOpenRouter.complete.mockResolvedValue({ content: 'invalid json', model: 'test' })
    mockOpenRouter.extractJSON.mockReturnValue('invalid json')

    const req = new Request('http://localhost/api/ai/inventory-forecast') as any
    const res = await inventoryForecastModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.forecasts).toBeDefined()
    expect(body.summary).toBeDefined()
  })
})

describe('GET /api/ai/cashflow-forecast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('generates cashflow forecast with data sources', async () => {
    ;(prisma.payment.findMany as any).mockResolvedValue([
      { amount: 5000, paymentDate: new Date('2026-02-20'), paymentMethod: 'CASH' },
    ])
    ;(prisma.appointment.findMany as any).mockResolvedValue([])
    ;(prisma.insuranceClaim.findMany as any).mockResolvedValue([])
    ;(prisma.invoice.findMany as any).mockResolvedValue([])
    ;(prisma.paymentPlanSchedule.findMany as any).mockResolvedValue([])

    const aiResult = {
      dailyForecast: [{ date: '2026-02-27', projected: 5000, appointments: 3 }],
      weeklyTotals: [],
      summary: { total30Day: 150000, avgDaily: 5000, bestDay: 'Monday', worstDay: 'Sunday', potentialShortfalls: [], trend: 'STABLE' },
    }
    mockOpenRouter.complete.mockResolvedValue({ content: JSON.stringify(aiResult), model: 'test-model' })
    mockOpenRouter.extractJSON.mockReturnValue(JSON.stringify(aiResult))

    const req = new Request('http://localhost/api/ai/cashflow-forecast') as any
    const res = await cashflowModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dailyForecast).toBeDefined()
    expect(body.summary.trend).toBe('STABLE')
  })

  it('falls back to simple projection when AI fails', async () => {
    ;(prisma.payment.findMany as any).mockResolvedValue([])
    ;(prisma.appointment.findMany as any).mockResolvedValue([])
    ;(prisma.insuranceClaim.findMany as any).mockResolvedValue([])
    ;(prisma.invoice.findMany as any).mockResolvedValue([])
    ;(prisma.paymentPlanSchedule.findMany as any).mockResolvedValue([])
    mockOpenRouter.complete.mockResolvedValue({ content: 'bad json', model: 'test' })
    mockOpenRouter.extractJSON.mockReturnValue('bad json')

    const req = new Request('http://localhost/api/ai/cashflow-forecast') as any
    const res = await cashflowModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dailyForecast).toHaveLength(30)
    expect(body.summary.trend).toBe('STABLE')
  })
})

describe('GET /api/ai/patient-segments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('returns empty when no patients', async () => {
    ;(prisma.patient.findMany as any).mockResolvedValue([])
    const req = new Request('http://localhost/api/ai/patient-segments') as any
    const res = await segmentsModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.patients).toEqual([])
  })

  it('segments patients with AI and enriches with display info', async () => {
    const patients = [
      { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe', phone: '9876543210', createdAt: new Date('2025-01-01') },
    ]
    ;(prisma.patient.findMany as any).mockResolvedValue(patients)
    ;(prisma.appointment.findMany as any).mockResolvedValue([
      { patientId: 'p1', scheduledDate: new Date('2026-02-01') },
    ])
    ;(prisma.appointment.groupBy as any).mockResolvedValue([
      { patientId: 'p1', _count: { id: 5 } },
    ])
    ;(prisma.invoice.findMany as any).mockResolvedValue([
      { patientId: 'p1', paidAmount: 15000 },
    ])

    const aiResult = {
      patients: [{ patientId: 'p1', rfm: { recency: 25, frequency: 5, monetary: 15000 }, segment: 'VIP', churnRisk: 10, churnLevel: 'LOW', recommendation: 'VIP treatment' }],
      summary: { vip: 1, loyal: 0, regular: 0, atRisk: 0, churning: 0, new: 0, avgChurnRisk: 10, topRetentionActions: ['Send thank you'] },
    }
    mockOpenRouter.complete.mockResolvedValue({ content: JSON.stringify(aiResult), model: 'test-model' })
    mockOpenRouter.extractJSON.mockReturnValue(JSON.stringify(aiResult))

    const req = new Request('http://localhost/api/ai/patient-segments') as any
    const res = await segmentsModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.patients).toHaveLength(1)
    expect(body.summary.vip).toBe(1)
  })

  it('falls back to rule-based segmentation when AI fails', async () => {
    ;(prisma.patient.findMany as any).mockResolvedValue([
      { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe', phone: '9876543210', createdAt: new Date('2025-01-01') },
    ])
    ;(prisma.appointment.findMany as any).mockResolvedValue([])
    ;(prisma.appointment.groupBy as any).mockResolvedValue([])
    ;(prisma.invoice.findMany as any).mockResolvedValue([])
    mockOpenRouter.complete.mockResolvedValue({ content: 'bad', model: 'test' })
    mockOpenRouter.extractJSON.mockReturnValue('bad')

    const req = new Request('http://localhost/api/ai/patient-segments') as any
    const res = await segmentsModule.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.patients).toBeDefined()
    expect(body.summary).toBeDefined()
  })
})

describe('POST /api/ai/claim-analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('returns 400 when claimId missing', async () => {
    const res = await claimModule.POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when claim not found', async () => {
    ;(prisma.insuranceClaim.findFirst as any).mockResolvedValue(null)
    const res = await claimModule.POST(makeRequest({ claimId: 'claim-999' }))
    expect(res.status).toBe(404)
  })

  it('analyzes denied claim and logs execution', async () => {
    ;(prisma.insuranceClaim.findFirst as any).mockResolvedValue({
      id: 'claim-1',
      claimNumber: 'CLM001',
      insuranceProvider: 'Star Health',
      policyNumber: 'POL001',
      claimAmount: 50000,
      approvedAmount: null,
      status: 'REJECTED',
      submittedDate: new Date(),
      rejectionReason: 'Incomplete documentation',
      denialCode: 'DOC001',
      appealStatus: null,
      appealNotes: null,
      patient: { firstName: 'John', lastName: 'Doe', patientId: 'PAT001', dateOfBirth: new Date('1990-01-01') },
      invoices: [{ invoiceNo: 'INV001', totalAmount: 50000, items: [] }],
    })
    ;(prisma.insuranceClaim.findMany as any).mockResolvedValue([])

    const aiResult = {
      analysis: { likelyCause: 'Missing docs', denialCategory: 'DOCUMENTATION', severityOfDenial: 'RECOVERABLE' },
      suggestions: [{ action: 'Resubmit with documents', priority: 'HIGH' }],
      appealLetter: 'Dear Sir...',
      preventionTips: ['Always attach supporting docs'],
    }
    mockOpenRouter.complete.mockResolvedValue({ content: JSON.stringify(aiResult), usage: { totalTokens: 800 }, model: 'test-model' })
    mockOpenRouter.extractJSON.mockReturnValue(JSON.stringify(aiResult))
    ;(prisma.aISkillExecution.create as any).mockResolvedValue({})

    const res = await claimModule.POST(makeRequest({ claimId: 'claim-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analysis.denialCategory).toBe('DOCUMENTATION')
    expect(body.claimId).toBe('claim-1')
    expect(prisma.aISkillExecution.create).toHaveBeenCalled()
  })

  it('falls back when AI parsing fails', async () => {
    ;(prisma.insuranceClaim.findFirst as any).mockResolvedValue({
      id: 'claim-1',
      claimNumber: 'CLM001',
      insuranceProvider: 'Star Health',
      policyNumber: 'POL001',
      claimAmount: 50000,
      approvedAmount: null,
      status: 'REJECTED',
      submittedDate: new Date(),
      rejectionReason: 'Unknown',
      denialCode: null,
      appealStatus: null,
      appealNotes: null,
      patient: { firstName: 'John', lastName: 'Doe', patientId: 'PAT001', dateOfBirth: new Date() },
      invoices: [],
    })
    ;(prisma.insuranceClaim.findMany as any).mockResolvedValue([])
    mockOpenRouter.complete.mockResolvedValue({ content: 'bad json', usage: { totalTokens: 100 }, model: 'test' })
    mockOpenRouter.extractJSON.mockReturnValue('bad json')
    ;(prisma.aISkillExecution.create as any).mockResolvedValue({})

    const res = await claimModule.POST(makeRequest({ claimId: 'claim-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analysis.denialCategory).toBe('OTHER')
    expect(body.suggestions).toBeDefined()
  })

  it('returns 401 for unauthorized roles', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: null,
      session: null,
    })
    const res = await claimModule.POST(makeRequest({ claimId: 'claim-1' }))
    expect(res.status).toBe(401)
  })
})
