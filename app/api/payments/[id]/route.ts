import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get single payment details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const payment = await prisma.payment.findUnique({
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
                phone: true,
                email: true,
              }
            }
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error("Error fetching payment:", error)
    return NextResponse.json(
      { error: "Failed to fetch payment" },
      { status: 500 }
    )
  }
}

// PUT - Update payment (mainly for notes or processing refunds)
export async function PUT(
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
        { error: "You don't have permission to update payments" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

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

    const { notes, status } = body

    let updateData: any = {}

    // Allow updating notes
    if (notes !== undefined) {
      updateData.notes = notes
    }

    // Handle status changes (mainly for pending payments)
    if (status && status !== existingPayment.status) {
      // Only allow certain status changes
      if (existingPayment.status === "PENDING") {
        if (status === "COMPLETED" || status === "CANCELLED" || status === "FAILED") {
          updateData.status = status

          // If completing a pending payment, update invoice
          if (status === "COMPLETED") {
            const newPaidAmount = Number(existingPayment.invoice.paidAmount) + Number(existingPayment.amount)
            const newBalanceAmount = Number(existingPayment.invoice.totalAmount) - newPaidAmount

            let newInvoiceStatus = existingPayment.invoice.status
            if (newBalanceAmount <= 0) {
              newInvoiceStatus = "PAID"
            } else if (newPaidAmount > 0) {
              newInvoiceStatus = "PARTIALLY_PAID"
            }

            await prisma.invoice.update({
              where: { id: existingPayment.invoiceId },
              data: {
                paidAmount: newPaidAmount,
                balanceAmount: newBalanceAmount,
                status: newInvoiceStatus,
              }
            })
          }
        } else {
          return NextResponse.json(
            { error: `Cannot change payment status from ${existingPayment.status} to ${status}` },
            { status: 400 }
          )
        }
      } else if (existingPayment.status === "COMPLETED" && status !== "COMPLETED") {
        return NextResponse.json(
          { error: "Cannot change status of a completed payment. Use refund instead." },
          { status: 400 }
        )
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    const payment = await prisma.payment.update({
      where: { id, hospitalId },
      data: updateData,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            status: true,
          }
        }
      }
    })

    return NextResponse.json(payment)
  } catch (error) {
    console.error("Error updating payment:", error)
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a pending payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to delete payments" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id, hospitalId }
    })

    if (!existingPayment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      )
    }

    // Only allow deleting pending or failed payments
    if (existingPayment.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot delete a completed payment. Use refund instead." },
        { status: 400 }
      )
    }

    // Delete the payment
    await prisma.payment.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Payment deleted successfully" })
  } catch (error) {
    console.error("Error deleting payment:", error)
    return NextResponse.json(
      { error: "Failed to delete payment" },
      { status: 500 }
    )
  }
}
