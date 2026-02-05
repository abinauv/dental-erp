import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// POST - Process refund for a payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to process refunds" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const {
      refundAmount,
      refundReason,
    } = body

    // Validate refund amount
    if (!refundAmount || refundAmount <= 0) {
      return NextResponse.json(
        { error: "Valid refund amount is required" },
        { status: 400 }
      )
    }

    // Check if payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id, hospitalId },
      include: {
        invoice: true
      }
    })

    if (!existingPayment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      )
    }

    // Only allow refund on completed payments
    if (existingPayment.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Can only refund completed payments" },
        { status: 400 }
      )
    }

    // Check if already refunded
    if (existingPayment.refundAmount && Number(existingPayment.refundAmount) > 0) {
      return NextResponse.json(
        { error: "Payment has already been refunded" },
        { status: 400 }
      )
    }

    // Check if refund amount exceeds payment amount
    if (refundAmount > Number(existingPayment.amount)) {
      return NextResponse.json(
        { error: `Refund amount (${refundAmount}) exceeds payment amount (${existingPayment.amount})` },
        { status: 400 }
      )
    }

    // Process refund
    const payment = await prisma.payment.update({
      where: { id, hospitalId },
      data: {
        status: "REFUNDED",
        refundAmount,
        refundDate: new Date(),
        refundReason,
      }
    })

    // Update invoice amounts
    const newPaidAmount = Number(existingPayment.invoice.paidAmount) - refundAmount
    const newBalanceAmount = Number(existingPayment.invoice.totalAmount) - newPaidAmount

    // Determine new invoice status
    let newStatus = existingPayment.invoice.status
    if (newPaidAmount <= 0) {
      newStatus = "REFUNDED"
    } else if (newBalanceAmount > 0) {
      newStatus = "PARTIALLY_PAID"
    }

    await prisma.invoice.update({
      where: { id: existingPayment.invoiceId },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        status: newStatus,
      }
    })

    // Return updated payment with invoice
    const updatedPayment = await prisma.payment.findUnique({
      where: { id, hospitalId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            status: true,
            patient: {
              select: {
                id: true,
                patientId: true,
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      message: "Refund processed successfully",
      payment: updatedPayment
    })
  } catch (error) {
    console.error("Error processing refund:", error)
    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500 }
    )
  }
}
