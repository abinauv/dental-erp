import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { calculateInvoiceTotals, gstConfig } from "@/lib/billing-utils"
import { DiscountType, InvoiceStatus } from "@prisma/client"

// GET - Get single invoice with full details
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

    const invoice = await prisma.invoice.findUnique({
      where: { id, hospitalId },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
          }
        },
        items: {
          include: {
            treatment: {
              select: {
                id: true,
                treatmentNo: true,
                toothNumbers: true,
                procedure: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    category: true,
                  }
                },
                doctor: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          }
        },
        payments: {
          orderBy: {
            paymentDate: 'desc'
          }
        },
        insuranceClaim: true,
      }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error("Error fetching invoice:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    )
  }
}

// PUT - Update invoice
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
        { error: "You don't have permission to update invoices" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id, hospitalId },
      include: {
        payments: true
      }
    })

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // Don't allow editing paid or refunded invoices
    if (existingInvoice.status === "PAID" || existingInvoice.status === "REFUNDED") {
      return NextResponse.json(
        { error: "Cannot edit a paid or refunded invoice" },
        { status: 400 }
      )
    }

    // Don't allow editing if there are completed payments
    const completedPayments = existingInvoice.payments.filter(p => p.status === "COMPLETED")
    if (completedPayments.length > 0 && body.items) {
      return NextResponse.json(
        { error: "Cannot edit invoice items after payments have been made" },
        { status: 400 }
      )
    }

    const {
      items,
      discountType,
      discountValue,
      cgstRate = existingInvoice.cgstRate,
      sgstRate = existingInvoice.sgstRate,
      dueDate,
      notes,
      termsAndConditions,
      status,
    } = body

    let updateData: any = {
      notes,
      termsAndConditions,
    }

    // Update due date if provided
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null
    }

    // Recalculate totals if items are being updated
    if (items && items.length > 0) {
      const calculatedTotals = calculateInvoiceTotals(
        items.map((item: any) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxable: item.taxable !== false
        })),
        (discountType || existingInvoice.discountType) as DiscountType,
        discountValue !== undefined ? discountValue : Number(existingInvoice.discountValue),
        cgstRate,
        sgstRate
      )

      updateData = {
        ...updateData,
        subtotal: calculatedTotals.subtotal,
        discountType: discountType || existingInvoice.discountType,
        discountValue: discountValue !== undefined ? discountValue : existingInvoice.discountValue,
        discountAmount: calculatedTotals.discountAmount,
        taxableAmount: calculatedTotals.taxableAmount,
        cgstRate,
        cgstAmount: calculatedTotals.cgstAmount,
        sgstRate,
        sgstAmount: calculatedTotals.sgstAmount,
        totalAmount: calculatedTotals.totalAmount,
        balanceAmount: calculatedTotals.totalAmount - Number(existingInvoice.paidAmount),
      }

      // Delete existing items and create new ones
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: id }
      })

      await prisma.invoiceItem.createMany({
        data: items.map((item: any) => ({
          invoiceId: id,
          treatmentId: item.treatmentId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
          taxable: item.taxable !== false,
        }))
      })
    }

    // Update status if provided and valid
    if (status) {
      // Validate status transition
      const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
        DRAFT: ["PENDING", "CANCELLED"],
        PENDING: ["PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
        PARTIALLY_PAID: ["PAID", "OVERDUE", "CANCELLED"],
        PAID: ["REFUNDED"],
        OVERDUE: ["PARTIALLY_PAID", "PAID", "CANCELLED"],
        CANCELLED: [],
        REFUNDED: [],
      }

      const allowedStatuses = validTransitions[existingInvoice.status]
      if (allowedStatuses && allowedStatuses.includes(status)) {
        updateData.status = status
      } else if (status !== existingInvoice.status) {
        return NextResponse.json(
          { error: `Cannot transition from ${existingInvoice.status} to ${status}` },
          { status: 400 }
        )
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id, hospitalId },
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          }
        },
        items: {
          include: {
            treatment: {
              select: {
                id: true,
                treatmentNo: true,
                procedure: {
                  select: {
                    name: true,
                    code: true
                  }
                }
              }
            }
          }
        },
        payments: {
          orderBy: {
            paymentDate: 'desc'
          }
        }
      }
    })

    return NextResponse.json(invoice)
  } catch (error) {
    console.error("Error updating invoice:", error)
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    )
  }
}

// DELETE - Delete/Cancel invoice
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
        { error: "You don't have permission to delete invoices" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id, hospitalId },
      include: {
        payments: true
      }
    })

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // If there are any completed payments, don't delete - just cancel
    const completedPayments = existingInvoice.payments.filter(p => p.status === "COMPLETED")

    if (completedPayments.length > 0) {
      // Cancel instead of delete
      const invoice = await prisma.invoice.update({
        where: { id, hospitalId },
        data: { status: "CANCELLED" }
      })
      return NextResponse.json({
        message: "Invoice cancelled (has payment history)",
        invoice
      })
    }

    // If no payments, we can delete the invoice
    // First delete related records
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: id }
    })

    await prisma.payment.deleteMany({
      where: { invoiceId: id }
    })

    // Delete the invoice
    await prisma.invoice.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Invoice deleted successfully" })
  } catch (error) {
    console.error("Error deleting invoice:", error)
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    )
  }
}
