import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getGateway } from "@/lib/payment-gateways"

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
    const signature =
      req.headers.get("x-razorpay-signature") ||
      req.headers.get("x-verify") ||
      ""

    // Parse the webhook payload
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Determine the gateway order ID from the webhook payload based on provider
    let gatewayOrderId: string | null = null

    switch (provider) {
      case "razorpay": {
        const entity = (payload.payload as Record<string, unknown>)?.payment as Record<string, unknown>
        const paymentEntity = entity?.entity as Record<string, string> | undefined
        gatewayOrderId = paymentEntity?.order_id || null
        break
      }
      case "phonepe": {
        // PhonePe sends base64 encoded response
        const base64Response = payload.response as string
        if (base64Response) {
          try {
            const decoded = JSON.parse(
              Buffer.from(base64Response, "base64").toString("utf8")
            )
            gatewayOrderId = decoded.data?.merchantTransactionId || null
          } catch {
            // ignore parse errors
          }
        }
        break
      }
      case "paytm": {
        const paytmBody = payload.body as Record<string, string> | undefined
        gatewayOrderId = paytmBody?.ORDERID || null
        break
      }
      default:
        return NextResponse.json(
          { error: `Unknown provider: ${provider}` },
          { status: 400 }
        )
    }

    if (!gatewayOrderId) {
      console.error("Webhook: could not extract order ID from payload")
      return NextResponse.json({ status: "ok" }) // Acknowledge but skip
    }

    // Find the payment record by gatewayOrderId to determine the hospital
    const existingPayment = await prisma.payment.findFirst({
      where: { gatewayOrderId },
      select: { hospitalId: true, id: true, status: true },
    })

    if (existingPayment) {
      // Payment already recorded (likely from client-side verify) — update status if needed
      if (existingPayment.status === "COMPLETED") {
        return NextResponse.json({ status: "already_processed" })
      }
    }

    // If no existing payment, try to find the hospital via the order ID pattern
    // For webhooks that arrive before client verification, we need to look up the config
    // and verify + create the payment record
    // This is the async fallback path — most payments are verified client-side first

    // Find which hospital this belongs to by searching payment configs
    // For now, we just acknowledge the webhook
    // The client-side verification flow handles the payment record creation

    // If we have an existing payment that's pending, update it
    if (existingPayment && existingPayment.status !== "COMPLETED") {
      const gatewayResult = await getGateway(existingPayment.hospitalId)
      if (gatewayResult) {
        const { gateway, credentials } = gatewayResult
        const verified = gateway.verifyWebhook(
          rawBody,
          signature,
          credentials.webhookSecret || ""
        )

        if (verified) {
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: { gatewayStatus: "captured", status: "COMPLETED" },
          })
        }
      }
    }

    return NextResponse.json({ status: "ok" })
  } catch (err) {
    console.error("Webhook processing error:", err)
    // Always return 200 to avoid gateway retries
    return NextResponse.json({ status: "error_logged" })
  }
}
