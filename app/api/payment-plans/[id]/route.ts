import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import prisma from "@/lib/prisma"

// GET /api/payment-plans/[id] — Get payment plan details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const plan = await prisma.paymentPlan.findFirst({
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
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            status: true,
          },
        },
        schedules: {
          orderBy: { installmentNo: "asc" },
        },
      },
    })

    if (!plan) {
      return NextResponse.json({ error: "Payment plan not found" }, { status: 404 })
    }

    // Get related payments for this plan's installments
    const paymentIds = plan.schedules
      .filter((s) => s.paymentId)
      .map((s) => s.paymentId as string)

    const payments =
      paymentIds.length > 0
        ? await prisma.payment.findMany({
            where: { id: { in: paymentIds } },
            select: {
              id: true,
              paymentNo: true,
              amount: true,
              paymentMethod: true,
              paymentDate: true,
              status: true,
            },
          })
        : []

    const paymentMap = new Map(payments.map((p) => [p.id, p]))

    return NextResponse.json({
      ...plan,
      totalAmount: Number(plan.totalAmount),
      downPayment: Number(plan.downPayment),
      interestRate: Number(plan.interestRate),
      invoice: plan.invoice
        ? {
            ...plan.invoice,
            totalAmount: Number(plan.invoice.totalAmount),
            paidAmount: Number(plan.invoice.paidAmount),
            balanceAmount: Number(plan.invoice.balanceAmount),
          }
        : null,
      schedules: plan.schedules.map((s) => ({
        ...s,
        amount: Number(s.amount),
        paidAmount: s.paidAmount ? Number(s.paidAmount) : null,
        payment: s.paymentId ? paymentMap.get(s.paymentId) || null : null,
      })),
      paidInstallments: plan.schedules.filter((s) => s.status === "PAID").length,
      overdueInstallments: plan.schedules.filter((s) => s.status === "OVERDUE").length,
      totalPaid:
        Number(plan.downPayment) +
        plan.schedules
          .filter((s) => s.status === "PAID")
          .reduce((sum, s) => sum + Number(s.paidAmount || s.amount), 0),
      totalRemaining: plan.schedules
        .filter((s) => s.status !== "PAID" && s.status !== "WAIVED")
        .reduce((sum, s) => sum + Number(s.amount), 0),
    })
  } catch (err) {
    console.error("Error fetching payment plan:", err)
    return NextResponse.json({ error: "Failed to fetch payment plan" }, { status: 500 })
  }
}

// PUT /api/payment-plans/[id] — Update payment plan status or cancel
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { action, notes } = body

    const plan = await prisma.paymentPlan.findFirst({
      where: { id, hospitalId },
      include: { schedules: true },
    })

    if (!plan) {
      return NextResponse.json({ error: "Payment plan not found" }, { status: 404 })
    }

    if (action === "cancel") {
      if (plan.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Only active plans can be cancelled" },
          { status: 400 }
        )
      }

      await prisma.$transaction([
        prisma.paymentPlan.update({
          where: { id },
          data: { status: "CANCELLED", notes: notes || plan.notes },
        }),
        // Mark all pending/overdue installments as waived
        prisma.paymentPlanSchedule.updateMany({
          where: {
            planId: id,
            status: { in: ["PENDING", "OVERDUE"] },
          },
          data: { status: "WAIVED" },
        }),
      ])

      return NextResponse.json({ message: "Payment plan cancelled" })
    }

    if (action === "waive") {
      // Waive a specific installment
      const { scheduleId } = body
      if (!scheduleId) {
        return NextResponse.json({ error: "Schedule ID required" }, { status: 400 })
      }

      const schedule = await prisma.paymentPlanSchedule.findFirst({
        where: { id: scheduleId, planId: id },
      })
      if (!schedule) {
        return NextResponse.json({ error: "Installment not found" }, { status: 404 })
      }
      if (schedule.status === "PAID") {
        return NextResponse.json({ error: "Cannot waive a paid installment" }, { status: 400 })
      }

      await prisma.paymentPlanSchedule.update({
        where: { id: scheduleId },
        data: { status: "WAIVED" },
      })

      // Check if all installments are now paid/waived
      const remaining = await prisma.paymentPlanSchedule.count({
        where: {
          planId: id,
          status: { in: ["PENDING", "OVERDUE"] },
        },
      })

      if (remaining === 0) {
        await prisma.paymentPlan.update({
          where: { id },
          data: { status: "COMPLETED", nextDueDate: null },
        })
      }

      return NextResponse.json({ message: "Installment waived" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    console.error("Error updating payment plan:", err)
    return NextResponse.json({ error: "Failed to update payment plan" }, { status: 500 })
  }
}
