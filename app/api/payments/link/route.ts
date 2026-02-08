import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedHospital } from "@/lib/api-helpers"
import { randomBytes } from "crypto"

/**
 * POST: Generate a short-lived payment link for an invoice.
 * The link can be shared with patients via WhatsApp/SMS.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user, hospitalId } = await getAuthenticatedHospital()
    if (error || !user || !hospitalId) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { invoiceId } = body as { invoiceId: string }

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 }
      )
    }

    // Validate invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
      select: {
        id: true,
        invoiceNo: true,
        balanceAmount: true,
        status: true,
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

    // Check if gateway is configured
    const gatewayConfig = await prisma.paymentGatewayConfig.findUnique({
      where: { hospitalId },
      select: { isEnabled: true },
    })

    if (!gatewayConfig?.isEnabled) {
      return NextResponse.json(
        { error: "Payment gateway is not enabled. Configure it in Settings > Billing." },
        { status: 400 }
      )
    }

    // Generate unique token
    const token = randomBytes(24).toString("hex")

    // Link expires in 48 hours
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

    const link = await prisma.paymentLink.create({
      data: {
        hospitalId,
        invoiceId: invoice.id,
        token,
        amount: balance,
        expiresAt,
      },
    })

    const paymentUrl = `${process.env.NEXTAUTH_URL}/pay/${token}`

    return NextResponse.json({
      success: true,
      link: {
        id: link.id,
        url: paymentUrl,
        token,
        amount: balance,
        expiresAt: expiresAt.toISOString(),
        invoiceNo: invoice.invoiceNo,
      },
    })
  } catch (err: unknown) {
    console.error("Payment link creation error:", err)
    return NextResponse.json(
      { error: "Failed to create payment link" },
      { status: 500 }
    )
  }
}
