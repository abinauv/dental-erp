import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { generatePaymentNo } from "@/lib/billing-utils"
import { PaymentMethod, PaymentStatus } from "@prisma/client"

// GET - Get payments for an invoice
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

    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id, hospitalId },
      select: {
        id: true,
        invoiceNo: true,
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
      }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    const payments = await prisma.payment.findMany({
      where: { invoiceId: id, hospitalId },
      orderBy: {
        paymentDate: 'desc'
      }
    })

    return NextResponse.json({
      invoice,
      payments
    })
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    )
  }
}

// POST - Record a payment for an invoice
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
    if (!["ADMIN", "ACCOUNTANT", "RECEPTIONIST"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to record payments" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const {
      amount,
      paymentMethod,
      paymentDate = new Date(),
      transactionId,
      bankName,
      chequeNumber,
      chequeDate,
      upiId,
      notes,
    } = body

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid payment amount is required" },
        { status: 400 }
      )
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Payment method is required" },
        { status: 400 }
      )
    }

    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id, hospitalId }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // Check if invoice can accept payments
    if (invoice.status === "CANCELLED" || invoice.status === "REFUNDED") {
      return NextResponse.json(
        { error: "Cannot add payment to a cancelled or refunded invoice" },
        { status: 400 }
      )
    }

    if (invoice.status === "PAID") {
      return NextResponse.json(
        { error: "Invoice is already fully paid" },
        { status: 400 }
      )
    }

    // Check if payment amount exceeds balance
    const currentBalance = Number(invoice.balanceAmount)
    if (amount > currentBalance) {
      return NextResponse.json(
        { error: `Payment amount (${amount}) exceeds balance (${currentBalance})` },
        { status: 400 }
      )
    }

    // Generate payment number
    const paymentNo = await generatePaymentNo(prisma)

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        hospitalId,
        paymentNo,
        invoiceId: id,
        amount,
        paymentMethod: paymentMethod as PaymentMethod,
        paymentDate: new Date(paymentDate),
        status: "COMPLETED",
        transactionId,
        bankName,
        chequeNumber,
        chequeDate: chequeDate ? new Date(chequeDate) : null,
        upiId,
        notes,
      }
    })

    // Update invoice amounts
    const newPaidAmount = Number(invoice.paidAmount) + amount
    const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount

    // Determine new invoice status
    let newStatus: "DRAFT" | "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" | "REFUNDED" = invoice.status
    if (newBalanceAmount <= 0) {
      newStatus = "PAID"
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIALLY_PAID"
    }

    // Update the invoice status to PENDING if it's still DRAFT
    if (invoice.status === "DRAFT") {
      newStatus = newBalanceAmount <= 0 ? "PAID" : "PARTIALLY_PAID"
    }

    await prisma.invoice.update({
      where: { id, hospitalId },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        status: newStatus,
      }
    })

    // Return updated invoice with payment
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id, hospitalId },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
          }
        },
        payments: {
          orderBy: {
            paymentDate: 'desc'
          }
        }
      }
    })

    return NextResponse.json({
      payment,
      invoice: updatedInvoice
    }, { status: 201 })
  } catch (error) {
    console.error("Error recording payment:", error)
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    )
  }
}
