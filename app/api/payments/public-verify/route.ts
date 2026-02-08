import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getGateway } from "@/lib/payment-gateways"

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
      return NextResponse.json(
        { error: "token, orderId, paymentId are required" },
        { status: 400 }
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
      return NextResponse.json({ error: "Invalid payment link" }, { status: 404 })
    }

    const hospitalId = link.hospitalId

    // Get gateway
    const gatewayResult = await getGateway(hospitalId)
    if (!gatewayResult) {
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 400 }
      )
    }

    const { gateway } = gatewayResult

    // Verify with gateway
    const result = await gateway.verifyPayment({
      orderId,
      paymentId,
      signature: signature || "",
      ...extra,
    })

    if (!result.verified) {
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 }
      )
    }

    // Create Payment record and update Invoice
    const paymentAmount = result.amount || Number(link.amount)
    const newPaidAmount = Number(link.invoice.paidAmount) + paymentAmount
    const newBalance = Number(link.invoice.totalAmount) - newPaidAmount

    // Generate payment number
    const lastPayment = await prisma.payment.findFirst({
      where: { hospitalId },
      orderBy: { createdAt: "desc" },
      select: { paymentNo: true },
    })
    const lastNum = lastPayment
      ? parseInt(lastPayment.paymentNo.replace(/\D/g, "")) || 0
      : 0
    const paymentNo = `PAY${String(lastNum + 1).padStart(5, "0")}`

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          hospitalId,
          paymentNo,
          invoiceId: link.invoice.id,
          amount: paymentAmount,
          paymentMethod: "ONLINE",
          paymentDate: new Date(),
          transactionId: result.transactionId,
          status: "COMPLETED",
          gateway: gatewayResult.credentials.provider.toLowerCase(),
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          gatewayStatus: result.status,
          notes: `Online payment via payment link`,
        },
      }),
      prisma.invoice.update({
        where: { id: link.invoice.id },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: Math.max(0, newBalance),
          status: newBalance <= 0 ? "PAID" : "PARTIALLY_PAID",
        },
      }),
      // Mark link as used
      prisma.paymentLink.update({
        where: { id: link.id },
        data: { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({
      success: true,
      payment: {
        paymentNo,
        amount: paymentAmount,
        transactionId: result.transactionId,
      },
    })
  } catch (err: unknown) {
    console.error("Public verify error:", err)
    const message = err instanceof Error ? err.message : "Verification failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
