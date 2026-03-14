import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedHospital } from "@/lib/api-helpers"
import { getGateway } from "@/lib/payment-gateways"

export async function POST(req: NextRequest) {
  try {
    const { error, user, hospitalId } = await getAuthenticatedHospital()
    if (error || !user || !hospitalId) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { invoiceId, amount } = body as {
      invoiceId: string
      amount?: number
    }

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 }
      )
    }

    // Fetch invoice and validate
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
      include: {
        patient: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
        hospital: { select: { name: true } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    const balance = Number(invoice.balanceAmount)
    if (balance <= 0) {
      return NextResponse.json(
        { error: "Invoice is already fully paid" },
        { status: 400 }
      )
    }

    const payAmount = amount ? Math.min(amount, balance) : balance
    if (payAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount" },
        { status: 400 }
      )
    }

    // Get gateway
    const gatewayResult = await getGateway(hospitalId)
    if (!gatewayResult) {
      return NextResponse.json(
        { error: "Payment gateway is not configured or not enabled" },
        { status: 400 }
      )
    }

    const { gateway, credentials } = gatewayResult

    // Create order with the gateway
    const order = await gateway.createOrder({
      amount: payAmount,
      currency: "INR",
      invoiceId: invoice.id,
      receipt: invoice.invoiceNo,
      customerName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
      customerEmail: invoice.patient.email || undefined,
      customerPhone: invoice.patient.phone,
    })

    // Get checkout config for the frontend
    const checkoutConfig = gateway.getCheckoutConfig(order, credentials)

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.orderId,
        amount: payAmount,
        currency: "INR",
        provider: order.provider,
      },
      checkout: checkoutConfig,
      hospital: { name: invoice.hospital.name },
      patient: {
        name: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        email: invoice.patient.email,
        phone: invoice.patient.phone,
      },
      invoice: {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        totalAmount: Number(invoice.totalAmount),
        balanceAmount: balance,
      },
    })
  } catch (err: unknown) {
    console.error("Payment order creation error:", err)
    const message = err instanceof Error ? err.message : "Failed to create payment order"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
