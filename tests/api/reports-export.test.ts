import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockFetch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.stubGlobal('fetch', mockFetch)

const mod = await import('@/app/api/reports/export/route')

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/reports/export')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString()) as any
}

describe('GET /api/reports/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
    ;(prisma.hospital.findUnique as any).mockResolvedValue({ name: 'Test Clinic' })
  })

  it('returns Excel file for patient analytics export', async () => {
    // Mock internal fetch to analytics endpoint
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        newPatients: 10,
        returningPatients: 50,
        totalPatients: 60,
        retentionRate: 83.33,
        demographics: { male: 30, female: 28, other: 2 },
        acquisitionSources: [{ source: 'Walk-in', count: 40, percentage: 66.67 }],
      }),
    })

    const req = makeRequest({ type: 'patient', format: 'excel', preset: 'this_month' })
    const res = await mod.GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    expect(res.headers.get('Content-Disposition')).toContain('patient_analytics')
  })

  it('returns HTML for PDF format export', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        totalTreatments: 100,
        completedTreatments: 80,
        inProgressTreatments: 20,
        completionRate: 80.0,
        avgTreatmentDuration: 45,
        commonProcedures: [],
      }),
    })

    const req = makeRequest({ type: 'clinical', format: 'pdf', preset: 'this_month' })
    const res = await mod.GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('Clinical Analytics Report')
    expect(body).toContain('Total Treatments')
  })

  it('exports financial report with payment method breakdown', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        totalRevenue: 500000,
        totalExpenses: 200000,
        profitMargin: 60.0,
        avgBillValue: 5000,
        collectionEfficiency: 85.0,
        outstandingAmount: 75000,
        paymentMethodBreakdown: [{ method: 'UPI', amount: 300000, percentage: 60.0 }],
        revenueByMonth: [],
      }),
    })

    const req = makeRequest({ type: 'financial', format: 'pdf' })
    const res = await mod.GET(req)
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('Financial')
    expect(body).toContain('Total Revenue')
  })

  it('exports operational report', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        totalAppointments: 200,
        completedAppointments: 180,
        cancelledAppointments: 10,
        noShowCount: 10,
        noShowRate: 5.0,
        appointmentUtilization: 90.0,
        avgWaitTime: 15,
        inventoryTurnover: 3.5,
        lowStockItems: 5,
        staffProductivity: [],
      }),
    })

    const req = makeRequest({ type: 'operational', format: 'pdf' })
    const res = await mod.GET(req)
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('Operational')
    expect(body).toContain('No-Show')
  })

  it('returns 400 for invalid export format', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ newPatients: 0, returningPatients: 0, totalPatients: 0, retentionRate: 0, demographics: { male: 0, female: 0, other: 0 }, acquisitionSources: [] }),
    })

    const req = makeRequest({ type: 'patient', format: 'csv' })
    const res = await mod.GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when analytics fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false })

    const req = makeRequest({ type: 'patient', format: 'excel' })
    const res = await mod.GET(req)
    expect(res.status).toBe(500)
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      hospitalId: null,
    })

    const req = makeRequest({ type: 'patient', format: 'excel' })
    const res = await mod.GET(req)
    expect(res.status).toBe(401)
  })
})
