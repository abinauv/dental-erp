import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGateway } from '@/lib/payment-gateways'
import { settlePayment } from '@/lib/payment-gateways/settle'
import { logger } from '@/lib/logger'

/**
 * Webhook handler for payment gateway callbacks.
 * Dynamic route: /api/webhooks/payment/razorpay, /api/webhooks/payment/phonepe, /api/webhooks/payment/paytm
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature') || req.headers.get('x-verify') || ''

    // Parse the webhook payload
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Determine the gateway order ID from the webhook payload based on provider
    let gatewayOrderId: string | null = null

    switch (provider) {
      case 'razorpay': {
        const entity = (payload.payload as Record<string, unknown>)?.payment as Record<
          string,
          unknown
        >
        const paymentEntity = entity?.entity as Record<string, string> | undefined
        gatewayOrderId = paymentEntity?.order_id || null
        break
      }
      case 'phonepe': {
        // PhonePe sends base64 encoded response
        const base64Response = payload.response as string
        if (base64Response) {
          try {
            const decoded = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf8'))
            gatewayOrderId = decoded.data?.merchantTransactionId || null
          } catch {
            // ignore parse errors
          }
        }
        break
      }
      case 'paytm': {
        const paytmBody = payload.body as Record<string, string> | undefined
        gatewayOrderId = paytmBody?.ORDERID || null
        break
      }
      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
    }

    if (!gatewayOrderId) {
      logger.error('Webhook: could not extract order ID from payload')
      return NextResponse.json({ status: 'ok' }) // Acknowledge but skip
    }

    // Find the payment reserved for this order at order-creation time. It carries
    // the hospital and invoice the order maps to — without it there is no reliable
    // way to resolve either from the gateway's order id alone.
    const existingPayment = await prisma.payment.findFirst({
      where: { gatewayOrderId },
      select: { hospitalId: true, id: true, status: true, invoiceId: true, amount: true },
    })

    if (!existingPayment) {
      // No reserved payment (e.g. an order created before reservation existed).
      // We cannot settle it safely, so acknowledge without processing.
      logger.error({ err: gatewayOrderId }, 'Webhook: no payment record for order')
      return NextResponse.json({ status: 'ok' })
    }

    if (existingPayment.status === 'COMPLETED') {
      return NextResponse.json({ status: 'already_processed' })
    }

    // Verify the signature before trusting the webhook.
    const gatewayResult = await getGateway(existingPayment.hospitalId)
    if (!gatewayResult) {
      return NextResponse.json({ status: 'ok' })
    }

    const { gateway, credentials } = gatewayResult
    const verified = gateway.verifyWebhook(rawBody, signature, credentials.webhookSecret || '')
    if (!verified) {
      logger.error({ err: gatewayOrderId }, 'Webhook: signature verification failed for order')
      // Return 200 so the gateway does not retry a payload we have rejected.
      return NextResponse.json({ status: 'invalid_signature' })
    }

    // Settle the reserved payment and apply it to the invoice. Idempotent with the
    // client-side verify flow — whichever runs first wins; the other is a no-op.
    await settlePayment({
      hospitalId: existingPayment.hospitalId,
      invoiceId: existingPayment.invoiceId,
      gatewayOrderId,
      provider,
      amount: Number(existingPayment.amount),
      gatewayStatus: 'captured',
      notes: `Online payment via ${provider} (webhook)`,
    })

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    logger.error({ err }, 'Webhook processing error:')
    // Always return 200 to avoid gateway retries
    return NextResponse.json({ status: 'error_logged' })
  }
}
