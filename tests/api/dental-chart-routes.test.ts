import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const listModule = await import('@/app/api/dental-chart/route')
const detailModule = await import('@/app/api/dental-chart/[id]/route')

function makeListRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/dental-chart')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString(), { method: 'GET' }) as any
}

function makePostRequest(body: any) {
  return new Request('http://localhost/api/dental-chart', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

function makeDetailRequest(method: string, body?: any) {
  return new Request('http://localhost/api/dental-chart/entry-1', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

const detailCtx = { params: Promise.resolve({ id: 'entry-1' }) }

describe('Dental Chart API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'DOCTOR' } },
    })
  })

  // ─── GET /api/dental-chart ─────────────────────────────
  describe('GET /api/dental-chart', () => {
    it('returns entries grouped by tooth number', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })

      const entries = [
        { id: 'e1', toothNumber: 16, condition: 'CAVITY', patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' } },
        { id: 'e2', toothNumber: 16, condition: 'FILLING', patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' } },
        { id: 'e3', toothNumber: 21, condition: 'CROWN', patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' } },
      ]
      ;(prisma.dentalChartEntry.findMany as any).mockResolvedValue(entries)

      const res = await listModule.GET(makeListRequest({ patientId: 'p1' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.entries).toHaveLength(3)
      expect(body.chartData['16']).toHaveLength(2)
      expect(body.chartData['21']).toHaveLength(1)
      expect(body.patientId).toBe('p1')
    })

    it('returns 400 when patientId is missing', async () => {
      const res = await listModule.GET(makeListRequest())
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('Patient ID is required')
    })

    it('returns 404 when patient not found', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)

      const res = await listModule.GET(makeListRequest({ patientId: 'missing' }))
      expect(res.status).toBe(404)
    })

    it('filters by toothNumber', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })
      ;(prisma.dentalChartEntry.findMany as any).mockResolvedValue([])

      await listModule.GET(makeListRequest({ patientId: 'p1', toothNumber: '16' }))
      const whereArg = (prisma.dentalChartEntry.findMany as any).mock.calls[0][0].where
      expect(whereArg.toothNumber).toBe(16)
    })

    it('filters by condition', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })
      ;(prisma.dentalChartEntry.findMany as any).mockResolvedValue([])

      await listModule.GET(makeListRequest({ patientId: 'p1', condition: 'CAVITY' }))
      const whereArg = (prisma.dentalChartEntry.findMany as any).mock.calls[0][0].where
      expect(whereArg.condition).toBe('CAVITY')
    })

    it('filters active entries (not resolved)', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })
      ;(prisma.dentalChartEntry.findMany as any).mockResolvedValue([])

      await listModule.GET(makeListRequest({ patientId: 'p1', isActive: 'true' }))
      const whereArg = (prisma.dentalChartEntry.findMany as any).mock.calls[0][0].where
      expect(whereArg.resolvedDate).toBeNull()
    })
  })

  // ─── POST /api/dental-chart ────────────────────────────
  describe('POST /api/dental-chart', () => {
    it('creates a dental chart entry', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })
      ;(prisma.dentalChartEntry.create as any).mockResolvedValue({
        id: 'new-entry',
        toothNumber: 16,
        condition: 'CAVITY',
        severity: 'MILD',
        patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' },
      })

      const res = await listModule.POST(
        makePostRequest({ patientId: 'p1', toothNumber: 16, condition: 'CAVITY' })
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.toothNumber).toBe(16)
    })

    it('returns 400 when required fields missing', async () => {
      const res = await listModule.POST(makePostRequest({ patientId: 'p1' }))
      expect(res.status).toBe(400)
    })

    it('rejects invalid FDI tooth number', async () => {
      const res = await listModule.POST(
        makePostRequest({ patientId: 'p1', toothNumber: 99, condition: 'CAVITY' })
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('FDI')
    })

    it('returns 404 when patient not found', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)

      const res = await listModule.POST(
        makePostRequest({ patientId: 'missing', toothNumber: 16, condition: 'CAVITY' })
      )
      expect(res.status).toBe(404)
    })

    it('auto-resolves previous entries for MISSING condition', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })
      ;(prisma.dentalChartEntry.updateMany as any).mockResolvedValue({ count: 2 })
      ;(prisma.dentalChartEntry.create as any).mockResolvedValue({
        id: 'new-entry',
        toothNumber: 36,
        condition: 'MISSING',
        patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' },
      })

      const res = await listModule.POST(
        makePostRequest({ patientId: 'p1', toothNumber: 36, condition: 'MISSING' })
      )
      expect(res.status).toBe(201)
      expect(prisma.dentalChartEntry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'p1',
            toothNumber: 36,
            resolvedDate: null,
          }),
        })
      )
    })

    it('auto-resolves previous entries for EXTRACTION condition', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1' })
      ;(prisma.dentalChartEntry.updateMany as any).mockResolvedValue({ count: 1 })
      ;(prisma.dentalChartEntry.create as any).mockResolvedValue({
        id: 'new-entry',
        toothNumber: 48,
        condition: 'EXTRACTION',
        patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' },
      })

      await listModule.POST(
        makePostRequest({ patientId: 'p1', toothNumber: 48, condition: 'EXTRACTION' })
      )
      expect(prisma.dentalChartEntry.updateMany).toHaveBeenCalled()
    })

    it('returns 403 for non-ADMIN/DOCTOR roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'RECEPTIONIST' } },
      })

      const res = await listModule.POST(
        makePostRequest({ patientId: 'p1', toothNumber: 16, condition: 'CAVITY' })
      )
      expect(res.status).toBe(403)
    })
  })

  // ─── GET /api/dental-chart/[id] ───────────────────────
  describe('GET /api/dental-chart/[id]', () => {
    it('returns a single entry', async () => {
      ;(prisma.dentalChartEntry.findFirst as any).mockResolvedValue({
        id: 'entry-1',
        toothNumber: 16,
        condition: 'CAVITY',
        patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' },
      })

      const res = await detailModule.GET(makeDetailRequest('GET'), detailCtx)
      expect(res.status).toBe(200)
    })

    it('returns 404 when not found', async () => {
      ;(prisma.dentalChartEntry.findFirst as any).mockResolvedValue(null)

      const res = await detailModule.GET(makeDetailRequest('GET'), detailCtx)
      expect(res.status).toBe(404)
    })
  })

  // ─── PUT /api/dental-chart/[id] ───────────────────────
  describe('PUT /api/dental-chart/[id]', () => {
    it('updates surfaces and condition', async () => {
      ;(prisma.dentalChartEntry.findFirst as any).mockResolvedValue({ id: 'entry-1' })
      ;(prisma.dentalChartEntry.update as any).mockResolvedValue({
        id: 'entry-1',
        condition: 'FILLING',
        mesial: true,
        distal: false,
        patient: { id: 'p1', patientId: 'PAT001', firstName: 'John', lastName: 'Doe' },
      })

      const res = await detailModule.PUT(
        makeDetailRequest('PUT', { condition: 'FILLING', mesial: true }),
        detailCtx
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.condition).toBe('FILLING')
      expect(body.mesial).toBe(true)
    })

    it('returns 404 when entry not found', async () => {
      ;(prisma.dentalChartEntry.findFirst as any).mockResolvedValue(null)

      const res = await detailModule.PUT(
        makeDetailRequest('PUT', { condition: 'FILLING' }),
        detailCtx
      )
      expect(res.status).toBe(404)
    })

    it('returns 403 for non-ADMIN/DOCTOR roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'RECEPTIONIST' } },
      })

      const res = await detailModule.PUT(
        makeDetailRequest('PUT', { condition: 'FILLING' }),
        detailCtx
      )
      expect(res.status).toBe(403)
    })
  })

  // ─── DELETE /api/dental-chart/[id] ────────────────────
  describe('DELETE /api/dental-chart/[id]', () => {
    it('hard deletes entry', async () => {
      ;(prisma.dentalChartEntry.findFirst as any).mockResolvedValue({ id: 'entry-1' })
      ;(prisma.dentalChartEntry.delete as any).mockResolvedValue({})

      const res = await detailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('deleted')
      expect(prisma.dentalChartEntry.delete).toHaveBeenCalledWith({ where: { id: 'entry-1' } })
    })

    it('returns 404 when entry not found', async () => {
      ;(prisma.dentalChartEntry.findFirst as any).mockResolvedValue(null)

      const res = await detailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(404)
    })

    it('returns 403 for non-ADMIN/DOCTOR roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'RECEPTIONIST' } },
      })

      const res = await detailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(403)
    })
  })
})
