import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const listModule = await import('@/app/api/procedures/route')
const detailModule = await import('@/app/api/procedures/[id]/route')

function makeListRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/procedures')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString(), { method: 'GET' }) as any
}

function makePostRequest(body: any) {
  return new Request('http://localhost/api/procedures', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

function makeDetailRequest(method: string, body?: any) {
  return new Request('http://localhost/api/procedures/proc-1', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

const detailCtx = { params: Promise.resolve({ id: 'proc-1' }) }

describe('Procedures API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  // ─── GET /api/procedures ───────────────────────────────
  describe('GET /api/procedures', () => {
    it('returns paginated procedures', async () => {
      const procedures = [
        { id: 'p1', code: 'PRV001', name: 'Cleaning', category: 'PREVENTIVE', basePrice: 500, isActive: true },
        { id: 'p2', code: 'RST001', name: 'Filling', category: 'RESTORATIVE', basePrice: 1500, isActive: true },
      ]
      ;(prisma.procedure.findMany as any).mockResolvedValue(procedures)
      ;(prisma.procedure.count as any).mockResolvedValue(2)

      const res = await listModule.GET(makeListRequest())
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.procedures).toHaveLength(2)
      expect(body.pagination.total).toBe(2)
    })

    it('filters by search term', async () => {
      ;(prisma.procedure.findMany as any).mockResolvedValue([])
      ;(prisma.procedure.count as any).mockResolvedValue(0)

      await listModule.GET(makeListRequest({ search: 'filling' }))
      const whereArg = (prisma.procedure.findMany as any).mock.calls[0][0].where
      expect(whereArg.OR).toBeDefined()
      expect(whereArg.OR.length).toBe(3) // code, name, description
    })

    it('filters by category', async () => {
      ;(prisma.procedure.findMany as any).mockResolvedValue([])
      ;(prisma.procedure.count as any).mockResolvedValue(0)

      await listModule.GET(makeListRequest({ category: 'PREVENTIVE' }))
      const whereArg = (prisma.procedure.findMany as any).mock.calls[0][0].where
      expect(whereArg.category).toBe('PREVENTIVE')
    })

    it('filters by isActive', async () => {
      ;(prisma.procedure.findMany as any).mockResolvedValue([])
      ;(prisma.procedure.count as any).mockResolvedValue(0)

      await listModule.GET(makeListRequest({ isActive: 'true' }))
      const whereArg = (prisma.procedure.findMany as any).mock.calls[0][0].where
      expect(whereArg.isActive).toBe(true)
    })

    it('skips pagination when all=true', async () => {
      ;(prisma.procedure.findMany as any).mockResolvedValue([])
      ;(prisma.procedure.count as any).mockResolvedValue(0)

      await listModule.GET(makeListRequest({ all: 'true' }))
      const opts = (prisma.procedure.findMany as any).mock.calls[0][0]
      expect(opts.skip).toBeUndefined()
      expect(opts.take).toBeUndefined()
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
        session: null,
      })

      const res = await listModule.GET(makeListRequest())
      expect(res.status).toBe(401)
    })
  })

  // ─── POST /api/procedures ──────────────────────────────
  describe('POST /api/procedures', () => {
    it('creates a new procedure with auto-generated code', async () => {
      ;(prisma.procedure.findFirst as any)
        .mockResolvedValueOnce(null) // name uniqueness check
        .mockResolvedValueOnce(null) // code generation (no existing)
      ;(prisma.procedure.create as any).mockResolvedValue({
        id: 'new-proc',
        code: 'PRV001',
        name: 'Teeth Cleaning',
        category: 'PREVENTIVE',
        basePrice: 500,
      })

      const res = await listModule.POST(
        makePostRequest({
          name: 'Teeth Cleaning',
          category: 'PREVENTIVE',
          basePrice: 500,
        })
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.code).toBe('PRV001')
    })

    it('returns 400 when required fields missing', async () => {
      const res = await listModule.POST(makePostRequest({ name: 'Test' }))
      expect(res.status).toBe(400)
    })

    it('returns 409 when name already exists', async () => {
      ;(prisma.procedure.findFirst as any).mockResolvedValue({ id: 'existing' })

      const res = await listModule.POST(
        makePostRequest({
          name: 'Filling',
          category: 'RESTORATIVE',
          basePrice: 1000,
        })
      )
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toContain('already exists')
    })

    it('returns 403 for non-ADMIN/DOCTOR roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'RECEPTIONIST' } },
      })

      const res = await listModule.POST(
        makePostRequest({
          name: 'Test',
          category: 'PREVENTIVE',
          basePrice: 500,
        })
      )
      expect(res.status).toBe(403)
    })

    it('generates incremented code when existing procedures exist', async () => {
      ;(prisma.procedure.findFirst as any)
        .mockResolvedValueOnce(null) // name uniqueness
        .mockResolvedValueOnce({ code: 'RST005' }) // last code for category
      ;(prisma.procedure.create as any).mockResolvedValue({
        id: 'new-proc',
        code: 'RST006',
        name: 'Crown',
        category: 'RESTORATIVE',
        basePrice: 5000,
      })

      const res = await listModule.POST(
        makePostRequest({
          name: 'Crown',
          category: 'RESTORATIVE',
          basePrice: 5000,
        })
      )
      expect(res.status).toBe(201)
    })
  })

  // ─── GET /api/procedures/[id] ─────────────────────────
  describe('GET /api/procedures/[id]', () => {
    it('returns procedure with treatment counts', async () => {
      ;(prisma.procedure.findUnique as any).mockResolvedValue({
        id: 'proc-1',
        code: 'PRV001',
        name: 'Cleaning',
        _count: { treatments: 10, treatmentPlanItems: 5 },
      })

      const res = await detailModule.GET(makeDetailRequest('GET'), detailCtx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body._count.treatments).toBe(10)
      expect(body._count.treatmentPlanItems).toBe(5)
    })

    it('returns 404 when not found', async () => {
      ;(prisma.procedure.findUnique as any).mockResolvedValue(null)

      const res = await detailModule.GET(makeDetailRequest('GET'), detailCtx)
      expect(res.status).toBe(404)
    })
  })

  // ─── PUT /api/procedures/[id] ─────────────────────────
  describe('PUT /api/procedures/[id]', () => {
    it('updates procedure fields', async () => {
      ;(prisma.procedure.findUnique as any).mockResolvedValue({
        id: 'proc-1',
        name: 'Cleaning',
        basePrice: 500,
      })
      ;(prisma.procedure.update as any).mockResolvedValue({
        id: 'proc-1',
        name: 'Cleaning',
        basePrice: 700,
      })

      const res = await detailModule.PUT(
        makeDetailRequest('PUT', { basePrice: 700 }),
        detailCtx
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.basePrice).toBe(700)
    })

    it('returns 409 when renaming to existing name', async () => {
      ;(prisma.procedure.findUnique as any).mockResolvedValue({
        id: 'proc-1',
        name: 'Cleaning',
      })
      ;(prisma.procedure.findFirst as any).mockResolvedValue({ id: 'proc-2', name: 'Filling' })

      const res = await detailModule.PUT(
        makeDetailRequest('PUT', { name: 'Filling' }),
        detailCtx
      )
      expect(res.status).toBe(409)
    })

    it('returns 404 when procedure not found', async () => {
      ;(prisma.procedure.findUnique as any).mockResolvedValue(null)

      const res = await detailModule.PUT(
        makeDetailRequest('PUT', { name: 'Test' }),
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
        makeDetailRequest('PUT', { name: 'Test' }),
        detailCtx
      )
      expect(res.status).toBe(403)
    })
  })

  // ─── DELETE /api/procedures/[id] ──────────────────────
  describe('DELETE /api/procedures/[id]', () => {
    it('hard deletes unused procedure', async () => {
      ;(prisma.procedure.findUnique as any).mockResolvedValue({
        id: 'proc-1',
        _count: { treatments: 0, treatmentPlanItems: 0 },
      })
      ;(prisma.procedure.delete as any).mockResolvedValue({})

      const res = await detailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.deleted).toBe(true)
      expect(prisma.procedure.delete).toHaveBeenCalled()
    })

    it('soft deletes procedure used in treatments', async () => {
      ;(prisma.procedure.findUnique as any).mockResolvedValue({
        id: 'proc-1',
        _count: { treatments: 5, treatmentPlanItems: 0 },
      })
      ;(prisma.procedure.update as any).mockResolvedValue({})

      const res = await detailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.deactivated).toBe(true)
      expect(prisma.procedure.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } })
      )
    })

    it('soft deletes procedure used in treatment plan items', async () => {
      ;(prisma.procedure.findUnique as any).mockResolvedValue({
        id: 'proc-1',
        _count: { treatments: 0, treatmentPlanItems: 3 },
      })
      ;(prisma.procedure.update as any).mockResolvedValue({})

      const res = await detailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      const body = await res.json()
      expect(body.deactivated).toBe(true)
    })

    it('returns 404 when not found', async () => {
      ;(prisma.procedure.findUnique as any).mockResolvedValue(null)

      const res = await detailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(404)
    })

    it('returns 403 for non-ADMIN roles', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: null,
        hospitalId: 'hospital-1',
        session: { user: { id: 'user-1', role: 'DOCTOR' } },
      })

      const res = await detailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(403)
    })
  })
})
