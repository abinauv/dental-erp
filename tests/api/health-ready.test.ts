import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const health = await import('@/app/api/health/route')
const ready = await import('@/app/api/ready/route')

describe('Liveness and readiness probes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/health', () => {
    it('returns 200 with an ok status', async () => {
      const res = await health.GET()
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.status).toBe('ok')
      expect(typeof body.uptime).toBe('number')
      expect(typeof body.timestamp).toBe('string')
    })

    it('does not touch the database', async () => {
      // The whole point of splitting liveness from readiness. If this probe
      // queried the database, a database blip would make an orchestrator kill
      // and restart healthy containers.
      await health.GET()
      expect(prisma.$queryRaw).not.toHaveBeenCalled()
    })

    it('is not cached', async () => {
      const res = await health.GET()
      expect(res.headers.get('Cache-Control')).toBe('no-store')
    })
  })

  describe('GET /api/ready', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      errorSpy.mockRestore()
    })

    it('returns 200 when the database responds', async () => {
      ;(prisma.$queryRaw as any).mockResolvedValue([{ 1: 1 }])

      const res = await ready.GET()
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.status).toBe('ready')
      expect(body.checks.database).toBe('ok')
    })

    it('returns 503 rather than throwing when the database is unreachable', async () => {
      ;(prisma.$queryRaw as any).mockRejectedValue(new Error("Can't reach database server"))

      // Must resolve, not reject. An unhandled throw here surfaces as a 500,
      // which is indistinguishable from the app being broken some other way.
      const res = await ready.GET()
      expect(res.status).toBe(503)

      const body = await res.json()
      expect(body.status).toBe('not_ready')
      expect(body.checks.database).toBe('error')
    })

    it('does not leak database connection details in the response', async () => {
      ;(prisma.$queryRaw as any).mockRejectedValue(
        new Error('connect ECONNREFUSED 10.0.0.5:3306 user=admin password=hunter2')
      )

      const res = await ready.GET()
      const raw = JSON.stringify(await res.json())

      // The endpoint is unauthenticated, so a driver error must not reach it.
      expect(raw).not.toContain('10.0.0.5')
      expect(raw).not.toContain('hunter2')
      expect(raw).not.toContain('ECONNREFUSED')
    })

    it('logs the underlying failure for operators', async () => {
      const cause = new Error('pool exhausted')
      ;(prisma.$queryRaw as any).mockRejectedValue(cause)

      await ready.GET()

      // Detail belongs in the logs, not the response body.
      expect(errorSpy).toHaveBeenCalledWith('[ready] database check failed:', cause)
    })

    it('is not cached', async () => {
      ;(prisma.$queryRaw as any).mockResolvedValue([{ 1: 1 }])

      const res = await ready.GET()
      expect(res.headers.get('Cache-Control')).toBe('no-store')
    })
  })
})
