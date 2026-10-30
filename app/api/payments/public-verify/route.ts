import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGateway } from '@/lib/payment-gateways'
import { settlePayment } from '@/lib/payment-gateways/settle'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * POST: Verify payment from public pay page (no auth — uses token).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, orderId, paymentId, signature, ...extra } = body as {
      token: string
      orderId: string
      paymentId: string
      signature: string
      [key: string]: unknown
    }

    if (!token || !orderId || !paymentId) {
      return NextResponse.json({ error: 'token, orderId, paymentId are required' }, { status: 400 })
    }

    // Unauthenticated endpoint: throttle per IP and per link token.
    const WINDOW = 10 * 60 * 1000
    const [byIp, byToken] = await Promise.all([
      checkRateLimit(`pay-verify-ip:${getClientIp(req)}`, 30, WINDOW),
      checkRateLimit(`pay-verify:${token}`, 15, WINDOW),
    ])
    if (!byIp.allowed || !byToken.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Look up payment link
    const link = await prisma.paymentLink.findUnique({
      where: { token },
      include: {
        invoice: true,
      },
    })

    if (!link) {
      return NextResponse.json({ error: 'Invalid payment link' }, { status: 404 })
    }

    const hospitalId = link.hospitalId

    // Get gateway
    const gatewayResult = await getGateway(hospitalId)
    if (!gatewayResult) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 400 })
    }

    const { gateway } = gatewayResult

    // Verify with gateway
    const result = await gateway.verifyPayment({
      orderId,
      paymentId,
      signature: signature || '',
      ...extra,
    })

    if (!result.verified) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    // Settle the (pre-reserved) payment and apply it to the invoice. Idempotent:
    // if the webhook already settled this order, this is a no-op.
    const settlement = await settlePayment({
      hospitalId,
      invoiceId: link.invoice.id,
      gatewayOrderId: orderId,
      provider: gatewayResult.credentials.provider,
      amount: result.amount ?? Number(link.amount),
      gatewayPaymentId: paymentId,
      transactionId: result.transactionId,
      gatewayStatus: result.status,
      notes: `Online payment via payment link`,
    })

    // Mark the link as used.
    await prisma.paymentLink.update({
      where: { id: link.id },
      data: { usedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      payment: {
        paymentNo: settlement.paymentNo,
        amount: settlement.amount,
        transactionId: result.transactionId,
      },
    })
  } catch (err: unknown) {
    logger.error({ err }, 'Public verify error:')
    const message = err instanceof Error ? err.message : 'Verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
