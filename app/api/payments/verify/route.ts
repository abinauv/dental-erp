import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedHospital } from '@/lib/api-helpers'
import { getGateway } from '@/lib/payment-gateways'
import { settlePayment } from '@/lib/payment-gateways/settle'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const { error, user, hospitalId } = await getAuthenticatedHospital()
    if (error || !user || !hospitalId) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { invoiceId, orderId, paymentId, signature, ...extra } = body as {
      invoiceId: string
      orderId: string
      paymentId: string
      signature: string
      [key: string]: unknown
    }

    if (!invoiceId || !orderId || !paymentId) {
      return NextResponse.json(
        { error: 'invoiceId, orderId, paymentId are required' },
        { status: 400 }
      )
    }

    // Fetch invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get gateway
    const gatewayResult = await getGateway(hospitalId)
    if (!gatewayResult) {
      return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 400 })
    }

    const { gateway } = gatewayResult

    // Verify payment with gateway
    const result = await gateway.verifyPayment({
      orderId,
      paymentId,
      signature: signature || '',
      ...extra,
    })

    if (!result.verified) {
      return NextResponse.json(
        { error: 'Payment verification failed', status: result.status },
        { status: 400 }
      )
    }

    // Settle the (pre-reserved) payment and apply it to the invoice. Idempotent:
    // if the webhook already settled this order, this is a no-op.
    const settlement = await settlePayment({
      hospitalId,
      invoiceId: invoice.id,
      gatewayOrderId: orderId,
      provider: gatewayResult.credentials.provider,
      amount: result.amount,
      gatewayPaymentId: paymentId,
      transactionId: result.transactionId,
      gatewayStatus: result.status,
      notes: `Online payment via ${gatewayResult.credentials.provider}`,
    })

    return NextResponse.json({
      success: true,
      payment: {
        id: settlement.paymentId,
        paymentNo: settlement.paymentNo,
        amount: settlement.amount,
        transactionId: result.transactionId,
        status: 'COMPLETED',
      },
    })
  } catch (err: unknown) {
    logger.error({ err }, 'Payment verification error:')
    const message = err instanceof Error ? err.message : 'Payment verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
