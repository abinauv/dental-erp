// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailLog: {
      updateMany: vi.fn(),
    },
  },
}))

import { GET } from '@/app/api/track/email/[id]/route'
import { prisma } from '@/lib/prisma'

function createParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('Email Tracking Pixel — GET /api/track/email/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.emailLog.updateMany).mockResolvedValue({ count: 1 })
  })

  it('should return a 1x1 transparent PNG pixel', async () => {
    const req = new Request('http://localhost/api/track/email/track-123')
    const res = await GET(req, createParams('track-123'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
  })

  it('should set correct Content-Length header', async () => {
    const req = new Request('http://localhost/api/track/email/track-123')
    const res = await GET(req, createParams('track-123'))

    const contentLength = parseInt(res.headers.get('Content-Length') || '0')
    expect(contentLength).toBeGreaterThan(0)
    expect(contentLength).toBe(70) // 1x1 transparent PNG
  })

  it('should set no-cache headers', async () => {
    const req = new Request('http://localhost/api/track/email/track-123')
    const res = await GET(req, createParams('track-123'))

    expect(res.headers.get('Cache-Control')).toContain('no-store')
    expect(res.headers.get('Cache-Control')).toContain('no-cache')
    expect(res.headers.get('Cache-Control')).toContain('must-revalidate')
    expect(res.headers.get('Pragma')).toBe('no-cache')
    expect(res.headers.get('Expires')).toBe('0')
  })

  it('should update openedAt for the tracking ID', async () => {
    const req = new Request('http://localhost/api/track/email/track-abc')
    await GET(req, createParams('track-abc'))

    // Allow microtask to run (background update)
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(prisma.emailLog.updateMany).toHaveBeenCalledWith({
      where: { trackingId: 'track-abc', openedAt: null },
      data: { openedAt: expect.any(Date) },
    })
  })

  it('should only update emails that have not been opened yet (openedAt: null)', async () => {
    const req = new Request('http://localhost/api/track/email/track-xyz')
    await GET(req, createParams('track-xyz'))

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(prisma.emailLog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ openedAt: null }),
      })
    )
  })

  it('should return pixel even when DB update fails', async () => {
    vi.mocked(prisma.emailLog.updateMany).mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/track/email/track-fail')
    const res = await GET(req, createParams('track-fail'))

    // Should still return the pixel — tracking should never break email
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
  })

  it('should return valid PNG data', async () => {
    const req = new Request('http://localhost/api/track/email/track-png')
    const res = await GET(req, createParams('track-png'))

    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // PNG magic bytes: 137 80 78 71 13 10 26 10
    expect(bytes[0]).toBe(137) // 0x89
    expect(bytes[1]).toBe(80)  // P
    expect(bytes[2]).toBe(78)  // N
    expect(bytes[3]).toBe(71)  // G
  })

  it('should not require authentication', async () => {
    // The route does not call requireAuthAndRole — it's a public tracking pixel
    const req = new Request('http://localhost/api/track/email/track-noauth')
    const res = await GET(req, createParams('track-noauth'))

    expect(res.status).toBe(200)
  })

  it('should handle different tracking IDs', async () => {
    const ids = ['id-1', 'id-2', 'id-3']

    for (const id of ids) {
      const req = new Request(`http://localhost/api/track/email/${id}`)
      const res = await GET(req, createParams(id))
      expect(res.status).toBe(200)
    }

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(prisma.emailLog.updateMany).toHaveBeenCalledTimes(3)
  })
})
