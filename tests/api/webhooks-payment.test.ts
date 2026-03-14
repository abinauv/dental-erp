// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

const { mockGetGateway } = vi.hoisted(() => ({
  mockGetGateway: vi.fn(),
}))
vi.mock('@/lib/payment-gateways', () => ({
  getGateway: mockGetGateway,
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { POST as webhookPOST } from '@/app/api/webhooks/payment/[provider]/route'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(
  provider: string,
  body: any,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`http://localhost/api/webhooks/payment/${provider}`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

function makeParams(provider: string) {
  return { params: Promise.resolve({ provider }) }
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/webhooks/payment/[provider]
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/webhooks/payment/[provider]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for unknown provider', async () => {
    const res = await webhookPOST(
      makeReq('stripe', { some: 'data' }),
      makeParams('stripe') as any,
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('Unknown provider')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/payment/razorpay', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'Content-Type': 'text/plain' },
    })
    const res = await webhookPOST(req, makeParams('razorpay') as any)
    expect(res.status).toBe(400)
  })

  it('handles razorpay webhook — extracts order_id', async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay1', hospitalId: 'h1', status: 'COMPLETED', gatewayOrderId: 'order_123',
    } as any)

    const res = await webhookPOST(
      makeReq('razorpay', {
        payload: {
          payment: {
            entity: { order_id: 'order_123', status: 'captured' },
          },
        },
      }, { 'x-razorpay-signature': 'sig123' }),
      makeParams('razorpay') as any,
    )
    const body = await res.json()

    expect(body.status).toBe('already_processed')
  })

  it('handles razorpay webhook — updates pending payment on verified', async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay1', hospitalId: 'h1', status: 'PENDING', gatewayOrderId: 'order_456',
    } as any)

    const mockGateway = {
      verifyWebhook: vi.fn().mockReturnValue(true),
    }
    mockGetGateway.mockResolvedValue({
      gateway: mockGateway,
      credentials: { webhookSecret: 'whsec_123' },
    })
    vi.mocked(prisma.payment.update).mockResolvedValue({} as any)

    const res = await webhookPOST(
      makeReq('razorpay', {
        payload: {
          payment: {
            entity: { order_id: 'order_456', status: 'captured' },
          },
        },
      }, { 'x-razorpay-signature': 'sig456' }),
      makeParams('razorpay') as any,
    )
    const body = await res.json()

    expect(body.status).toBe('ok')
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay1' },
      data: { gatewayStatus: 'captured', status: 'COMPLETED' },
    })
  })

  it('handles phonepe webhook — decodes base64 response', async () => {
    const phonepeData = JSON.stringify({
      data: { merchantTransactionId: 'order_789' },
    })
    const base64 = Buffer.from(phonepeData).toString('base64')

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay2', hospitalId: 'h1', status: 'COMPLETED',
    } as any)

    const res = await webhookPOST(
      makeReq('phonepe', { response: base64 }, { 'x-verify': 'verify123' }),
      makeParams('phonepe') as any,
    )
    const body = await res.json()

    expect(body.status).toBe('already_processed')
  })

  it('handles paytm webhook — extracts ORDERID', async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay3', hospitalId: 'h1', status: 'COMPLETED',
    } as any)

    const res = await webhookPOST(
      makeReq('paytm', {
        body: { ORDERID: 'order_paytm_001', STATUS: 'TXN_SUCCESS' },
      }),
      makeParams('paytm') as any,
    )
    const body = await res.json()

    expect(body.status).toBe('already_processed')
  })

  it('acknowledges webhook when order_id cannot be extracted', async () => {
    const res = await webhookPOST(
      makeReq('razorpay', { payload: {} }),
      makeParams('razorpay') as any,
    )
    const body = await res.json()

    // Should acknowledge but not process
    expect(body.status).toBe('ok')
  })

  it('handles errors gracefully and returns 200', async () => {
    vi.mocked(prisma.payment.findFirst).mockRejectedValue(new Error('DB down'))

    const res = await webhookPOST(
      makeReq('razorpay', {
        payload: { payment: { entity: { order_id: 'order_err' } } },
      }),
      makeParams('razorpay') as any,
    )
    const body = await res.json()

    // Always return 200 to avoid gateway retries
    expect(res.status).toBe(200)
    expect(body.status).toBe('error_logged')
  })
})
