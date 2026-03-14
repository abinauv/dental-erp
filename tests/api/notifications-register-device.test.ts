import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuthFn = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuthFn }))
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const mod = await import('@/app/api/notifications/register-device/route')

function makePostRequest(body: any) {
  return new Request('http://localhost/api/notifications/register-device', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

function makeDeleteRequest(token?: string) {
  const url = new URL('http://localhost/api/notifications/register-device')
  if (token) url.searchParams.set('token', token)
  return new Request(url.toString(), { method: 'DELETE' }) as any
}

describe('Push Device Registration API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthFn.mockResolvedValue({
      user: { id: 'user-1', hospitalId: 'hospital-1' },
    })
  })

  describe('POST /api/notifications/register-device', () => {
    it('registers a new device token', async () => {
      ;(prisma.pushDevice.upsert as any).mockResolvedValue({})

      const res = await mod.POST(makePostRequest({
        token: 'fcm-token-abc123',
        platform: 'web',
        deviceName: 'Chrome Desktop',
      }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(prisma.pushDevice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: 'fcm-token-abc123' },
          update: expect.objectContaining({ platform: 'web', isActive: true }),
          create: expect.objectContaining({ token: 'fcm-token-abc123', platform: 'web' }),
        })
      )
    })

    it('returns 401 when not authenticated', async () => {
      mockAuthFn.mockResolvedValue(null)
      const res = await mod.POST(makePostRequest({ token: 'tok', platform: 'web' }))
      expect(res.status).toBe(401)
    })

    it('returns 400 for invalid platform', async () => {
      const res = await mod.POST(makePostRequest({ token: 'tok', platform: 'windows' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when token is missing', async () => {
      const res = await mod.POST(makePostRequest({ platform: 'web' }))
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/notifications/register-device', () => {
    it('deactivates device by token', async () => {
      ;(prisma.pushDevice.updateMany as any).mockResolvedValue({ count: 1 })

      const res = await mod.DELETE(makeDeleteRequest('fcm-token-abc123'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: 'fcm-token-abc123', userId: 'user-1' },
          data: { isActive: false },
        })
      )
    })

    it('returns 401 when not authenticated', async () => {
      mockAuthFn.mockResolvedValue(null)
      const res = await mod.DELETE(makeDeleteRequest('tok'))
      expect(res.status).toBe(401)
    })

    it('returns 400 when token query param missing', async () => {
      const res = await mod.DELETE(makeDeleteRequest())
      expect(res.status).toBe(400)
    })
  })
})
