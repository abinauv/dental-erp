import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getGateway } from "@/lib/payment-gateways"

/**
 * POST: Create a payment order using a payment link token (no auth required).
 * Used by the public /pay/[token] page.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, amount } = body as { token: string; amount: number }

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    // Look up payment link
    const link = await prisma.paymentLink.findUnique({
      where: { token },
      include: {
        invoice: {
          include: {
            patient: {
              select: { firstName: true, lastName: true, email: true, phone: true },
            },
            hospital: { select: { name: true } },
          },
        },
      },
    })

    if (!link) {
      return NextResponse.json({ error: "Invalid payment link" }, { status: 404 })
    }

    // Validate link
    if (link.usedAt) {
      return NextResponse.json({ error: "This payment link has already been used" }, { status: 400 })
    }
    if (new Date() > new Date(link.expiresAt)) {
      return NextResponse.json({ error: "This payment link has expired" }, { status: 400 })
    }

    const balance = Number(link.invoice.balanceAmount)
    if (balance <= 0) {
      return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 })
    }

    const payAmount = Math.min(amount || balance, balance)

    // Get gateway for this hospital
    const gatewayResult = await getGateway(link.hospitalId)
    if (!gatewayResult) {
      return NextResponse.json(
        { error: "Payment gateway is not configured" },
        { status: 400 }
      )
    }

    const { gateway, credentials } = gatewayResult

    const order = await gateway.createOrder({
      amount: payAmount,
      currency: "INR",
      invoiceId: link.invoice.id,
      receipt: link.invoice.invoiceNo,
      customerName: `${link.invoice.patient.firstName} ${link.invoice.patient.lastName}`,
      customerEmail: link.invoice.patient.email || undefined,
      customerPhone: link.invoice.patient.phone,
    })

    const checkoutConfig = gateway.getCheckoutConfig(order, credentials)

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.orderId,
        amount: payAmount,
        provider: order.provider,
      },
      checkout: checkoutConfig,
    })
  } catch (err: unknown) {
    console.error("Public order error:", err)
    const message = err instanceof Error ? err.message : "Failed to create order"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
