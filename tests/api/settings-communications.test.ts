import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const mod = await import('@/app/api/settings/communications/route')

function makeGetRequest() {
  return new Request('http://localhost/api/settings/communications') as any
}

function makePostRequest(body: any) {
  return new Request('http://localhost/api/settings/communications', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

describe('Settings Communications API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  describe('GET /api/settings/communications', () => {
    it('returns organized settings from JSON records', async () => {
      ;(prisma.setting.findMany as any).mockResolvedValue([])
      ;(prisma.setting.findUnique as any)
        .mockResolvedValueOnce({ value: JSON.stringify({ gateway: 'twilio', apiKey: 'key123' }) })  // sms_settings
        .mockResolvedValueOnce({ value: JSON.stringify({ smtp_host: 'smtp.test.com' }) })  // email_settings
        .mockResolvedValueOnce({ value: JSON.stringify({ google_review_url: 'https://g.co/review' }) })  // reviews_settings

      const res = await mod.GET(makeGetRequest())
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.sms.gateway).toBe('twilio')
      expect(body.email.smtp_host).toBe('smtp.test.com')
      expect(body.reviews.google_review_url).toBe('https://g.co/review')
    })

    it('falls back to individual settings when no JSON record', async () => {
      ;(prisma.setting.findMany as any).mockResolvedValue([
        { category: 'sms', key: 'sms.gateway', value: 'msg91' },
        { category: 'email', key: 'email.smtp.host', value: 'smtp.example.com' },
      ])
      ;(prisma.setting.findUnique as any)
        .mockResolvedValueOnce(null)  // sms_settings
        .mockResolvedValueOnce(null)  // email_settings
        .mockResolvedValueOnce(null)  // reviews_settings

      const res = await mod.GET(makeGetRequest())
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.sms.gateway).toBe('msg91')
      expect(body.email.smtp_host).toBe('smtp.example.com')
      expect(body.reviews).toEqual({})
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
      })
      const res = await mod.GET(makeGetRequest())
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/settings/communications', () => {
    it('saves SMS settings with upsert', async () => {
      ;(prisma.setting.upsert as any).mockResolvedValue({})

      const res = await mod.POST(makePostRequest({
        type: 'sms',
        settings: { gateway: 'twilio', apiKey: 'key123', senderId: 'CLINIC', enabled: true },
      }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('SMS')
      // Main JSON upsert + individual settings upserts
      expect(prisma.setting.upsert).toHaveBeenCalled()
    })

    it('saves email settings', async () => {
      ;(prisma.setting.upsert as any).mockResolvedValue({})

      const res = await mod.POST(makePostRequest({
        type: 'email',
        settings: { smtp_host: 'smtp.test.com', smtp_port: '587', from_name: 'Clinic' },
      }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('EMAIL')
    })

    it('saves reviews settings', async () => {
      ;(prisma.setting.upsert as any).mockResolvedValue({})

      const res = await mod.POST(makePostRequest({
        type: 'reviews',
        settings: { google_review_url: 'https://g.co/review', auto_review_requests: true },
      }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('REVIEWS')
    })

    it('returns 400 when type or settings missing', async () => {
      const res = await mod.POST(makePostRequest({ type: 'sms' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid type', async () => {
      const res = await mod.POST(makePostRequest({ type: 'invalid', settings: {} }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain("'sms', 'email', or 'reviews'")
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
      })
      const res = await mod.POST(makePostRequest({ type: 'sms', settings: {} }))
      expect(res.status).toBe(401)
    })
  })
})
