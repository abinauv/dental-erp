import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import prisma from "@/lib/prisma"

// POST /api/payment-plans/[id]/pay — Record payment for an installment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!["ADMIN", "ACCOUNTANT", "RECEPTIONIST"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { scheduleId, amount, paymentMethod = "CASH", transactionId, notes } = body

    if (!scheduleId) {
      return NextResponse.json({ error: "Schedule ID is required" }, { status: 400 })
    }

    const plan = await prisma.paymentPlan.findFirst({
      where: { id, hospitalId, status: "ACTIVE" },
      include: { invoice: true },
    })

    if (!plan) {
      return NextResponse.json(
        { error: "Active payment plan not found" },
        { status: 404 }
      )
    }

    const schedule = await prisma.paymentPlanSchedule.findFirst({
      where: { id: scheduleId, planId: id },
    })

    if (!schedule) {
      return NextResponse.json({ error: "Installment not found" }, { status: 404 })
    }

    if (schedule.status === "PAID") {
      return NextResponse.json(
        { error: "This installment is already paid" },
        { status: 400 }
      )
    }

    if (schedule.status === "WAIVED") {
      return NextResponse.json(
        { error: "This installment has been waived" },
        { status: 400 }
      )
    }

    const payAmount = amount ? Number(amount) : Number(schedule.amount)

    // Generate payment number
    const lastPayment = await prisma.payment.findFirst({
      where: { hospitalId },
      orderBy: { createdAt: "desc" },
      select: { paymentNo: true },
    })

    let nextNum = 1
    if (lastPayment?.paymentNo) {
      const match = lastPayment.paymentNo.match(/(\d+)$/)
      if (match) nextNum = parseInt(match[1]) + 1
    }
    const paymentNo = `PAY${String(nextNum).padStart(5, "0")}`

    // Create payment and update schedule in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the payment record on the invoice
      const payment = await tx.payment.create({
        data: {
          hospitalId,
          paymentNo,
          invoiceId: plan.invoiceId,
          amount: payAmount,
          paymentMethod: paymentMethod as any,
          transactionId: transactionId || null,
          notes: notes || `Payment plan installment #${schedule.installmentNo}`,
          status: "COMPLETED",
        },
      })

      // Update the schedule
      await tx.paymentPlanSchedule.update({
        where: { id: scheduleId },
        data: {
          status: "PAID",
          paidDate: new Date(),
          paidAmount: payAmount,
          paymentId: payment.id,
        },
      })

      // Update invoice paid amount and status
      const newPaidAmount = Number(plan.invoice.paidAmount) + payAmount
      const newBalance = Number(plan.invoice.totalAmount) - newPaidAmount

      let invoiceStatus = plan.invoice.status
      if (newBalance <= 0) {
        invoiceStatus = "PAID"
      } else if (newPaidAmount > 0) {
        invoiceStatus = "PARTIALLY_PAID"
      }

      await tx.invoice.update({
        where: { id: plan.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: Math.max(0, newBalance),
          status: invoiceStatus as any,
        },
      })

      // Check if all installments are now paid/waived
      const remainingCount = await tx.paymentPlanSchedule.count({
        where: {
          planId: id,
          status: { in: ["PENDING", "OVERDUE"] },
        },
      })

      // Find next due date
      const nextSchedule = await tx.paymentPlanSchedule.findFirst({
        where: {
          planId: id,
          status: { in: ["PENDING", "OVERDUE"] },
        },
        orderBy: { dueDate: "asc" },
      })

      // Update plan status
      if (remainingCount === 0) {
        await tx.paymentPlan.update({
          where: { id },
          data: { status: "COMPLETED", nextDueDate: null },
        })
      } else {
        await tx.paymentPlan.update({
          where: { id },
          data: { nextDueDate: nextSchedule?.dueDate || null },
        })
      }

      return { payment, remainingInstallments: remainingCount }
    })

    return NextResponse.json({
      message: `Payment of ₹${payAmount.toLocaleString("en-IN")} recorded`,
      payment: result.payment,
      remainingInstallments: result.remainingInstallments,
    })
  } catch (err) {
    console.error("Error recording installment payment:", err)
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    )
  }
}
