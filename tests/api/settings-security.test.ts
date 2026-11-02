import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const securityModule = await import('@/app/api/settings/security/route')

function makeSecurityRequest(method: string, body?: any) {
  return new Request('http://localhost/api/settings/security', {
    method,
    ...(body
      ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
      : {}),
  }) as any
}

describe('Settings Security API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  // ─── GET /api/settings/security ───────────────────
  describe('GET /api/settings/security', () => {
    it('returns security settings parsed from JSON', async () => {
      ;(prisma.setting.findMany as any).mockResolvedValue([
        { key: 'passwordMinLength', value: '8', category: 'security' },
        { key: 'requireTwoFactor', value: 'true', category: 'security' },
        { key: 'sessionTimeoutMinutes', value: '30', category: 'security' },
        { key: 'maxLoginAttempts', value: '5', category: 'security' },
      ])

      const res = await securityModule.GET(makeSecurityRequest('GET'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.passwordMinLength).toBe(8)
      expect(body.data.requireTwoFactor).toBe(true)
      expect(body.data.sessionTimeoutMinutes).toBe(30)
    })

    it('returns empty object when no security settings exist', async () => {
      ;(prisma.setting.findMany as any).mockResolvedValue([])

      const res = await securityModule.GET(makeSecurityRequest('GET'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual({})
    })

    it('returns 401 when not ADMIN', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Forbidden' }, { status: 403 }),
        hospitalId: null,
      })

      const res = await securityModule.GET(makeSecurityRequest('GET'))
      expect(res.status).toBe(403)
    })
  })

  // ─── POST /api/settings/security ──────────────────
  describe('POST /api/settings/security', () => {
    it('updates security settings via upsert', async () => {
      ;(prisma.setting.upsert as any).mockResolvedValue({})

      const res = await securityModule.POST(
        makeSecurityRequest('POST', {
          passwordMinLength: 10,
          requireTwoFactor: true,
          sessionTimeoutMinutes: 60,
          maxLoginAttempts: 3,
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(prisma.setting.upsert).toHaveBeenCalledTimes(4)
    })

    it('validates min/max constraints', async () => {
      const res = await securityModule.POST(
        makeSecurityRequest('POST', {
          passwordMinLength: 2, // min is 6
        })
      )
      expect(res.status).toBe(500) // Zod throws, caught by catch block
    })

    it('validates session timeout min 5 minutes', async () => {
      const res = await securityModule.POST(
        makeSecurityRequest('POST', {
          sessionTimeoutMinutes: 1, // min is 5
        })
      )
      expect(res.status).toBe(500) // Zod throws
    })
  })
})
