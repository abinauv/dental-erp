import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import prisma from "@/lib/prisma"

// GET /api/payment-plans — List payment plans
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const patientId = searchParams.get("patientId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: any = { hospitalId }
    if (status) where.status = status
    if (patientId) where.patientId = patientId

    const [plans, total] = await Promise.all([
      prisma.paymentPlan.findMany({
        where,
        include: {
          patient: {
            select: { id: true, patientId: true, firstName: true, lastName: true, phone: true },
          },
          invoice: {
            select: { id: true, invoiceNo: true, totalAmount: true, balanceAmount: true },
          },
          schedules: {
            orderBy: { installmentNo: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.paymentPlan.count({ where }),
    ])

    // Summary counts
    const [activeCount, completedCount, defaultedCount, totalOutstanding] = await Promise.all([
      prisma.paymentPlan.count({ where: { hospitalId, status: "ACTIVE" } }),
      prisma.paymentPlan.count({ where: { hospitalId, status: "COMPLETED" } }),
      prisma.paymentPlan.count({ where: { hospitalId, status: "DEFAULTED" } }),
      prisma.paymentPlanSchedule.aggregate({
        where: {
          plan: { hospitalId },
          status: { in: ["PENDING", "OVERDUE"] },
        },
        _sum: { amount: true },
      }),
    ])

    return NextResponse.json({
      plans: plans.map((plan) => ({
        ...plan,
        totalAmount: Number(plan.totalAmount),
        downPayment: Number(plan.downPayment),
        interestRate: Number(plan.interestRate),
        schedules: plan.schedules.map((s) => ({
          ...s,
          amount: Number(s.amount),
          paidAmount: s.paidAmount ? Number(s.paidAmount) : null,
        })),
        paidInstallments: plan.schedules.filter((s) => s.status === "PAID").length,
        overdueInstallments: plan.schedules.filter((s) => s.status === "OVERDUE").length,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary: {
        active: activeCount,
        completed: completedCount,
        defaulted: defaultedCount,
        totalOutstanding: Number(totalOutstanding._sum.amount || 0),
      },
    })
  } catch (err) {
    console.error("Error fetching payment plans:", err)
    return NextResponse.json({ error: "Failed to fetch payment plans" }, { status: 500 })
  }
}

// POST /api/payment-plans — Create a new payment plan
export async function POST(req: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!["ADMIN", "ACCOUNTANT", "RECEPTIONIST"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await req.json()
    const {
      invoiceId,
      installments,
      frequency = "MONTHLY",
      downPayment = 0,
      interestRate = 0,
      startDate,
      notes,
    } = body

    if (!invoiceId || !installments || !startDate) {
      return NextResponse.json(
        { error: "Invoice, installments count, and start date are required" },
        { status: 400 }
      )
    }

    if (installments < 2 || installments > 60) {
      return NextResponse.json(
        { error: "Installments must be between 2 and 60" },
        { status: 400 }
      )
    }

    // Fetch the invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
    })
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot create payment plan for a paid or cancelled invoice" },
        { status: 400 }
      )
    }

    // Check if invoice already has an active plan
    const existingPlan = await prisma.paymentPlan.findFirst({
      where: { invoiceId, hospitalId, status: "ACTIVE" },
    })
    if (existingPlan) {
      return NextResponse.json(
        { error: "This invoice already has an active payment plan" },
        { status: 409 }
      )
    }

    const balanceAmount = Number(invoice.balanceAmount)
    const dpAmount = Math.min(Number(downPayment), balanceAmount)

    // Calculate total with interest
    const principal = balanceAmount - dpAmount
    const rate = Number(interestRate) / 100
    const totalWithInterest = principal * (1 + rate)
    const installmentAmount = Math.ceil((totalWithInterest / installments) * 100) / 100

    // Generate schedule
    const planStartDate = new Date(startDate)
    const schedules: Array<{
      installmentNo: number
      amount: number
      dueDate: Date
    }> = []

    for (let i = 0; i < installments; i++) {
      const dueDate = new Date(planStartDate)

      switch (frequency) {
        case "WEEKLY":
          dueDate.setDate(dueDate.getDate() + i * 7)
          break
        case "BIWEEKLY":
          dueDate.setDate(dueDate.getDate() + i * 14)
          break
        case "MONTHLY":
        default:
          dueDate.setMonth(dueDate.getMonth() + i)
          break
      }

      // Last installment adjusts for rounding
      const amount =
        i === installments - 1
          ? Math.round((totalWithInterest - installmentAmount * (installments - 1)) * 100) / 100
          : installmentAmount

      schedules.push({
        installmentNo: i + 1,
        amount,
        dueDate,
      })
    }

    // Create the plan with schedules in a transaction
    const plan = await prisma.$transaction(async (tx) => {
      const newPlan = await tx.paymentPlan.create({
        data: {
          hospitalId,
          invoiceId,
          patientId: invoice.patientId,
          totalAmount: totalWithInterest + dpAmount,
          downPayment: dpAmount,
          installments,
          frequency: frequency as any,
          interestRate,
          startDate: planStartDate,
          nextDueDate: schedules[0]?.dueDate || planStartDate,
          notes,
          createdBy: session.user.id,
          schedules: {
            create: schedules.map((s) => ({
              installmentNo: s.installmentNo,
              amount: s.amount,
              dueDate: s.dueDate,
            })),
          },
        },
        include: {
          schedules: { orderBy: { installmentNo: "asc" } },
          patient: {
            select: { id: true, patientId: true, firstName: true, lastName: true },
          },
          invoice: {
            select: { id: true, invoiceNo: true },
          },
        },
      })

      return newPlan
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (err) {
    console.error("Error creating payment plan:", err)
    return NextResponse.json({ error: "Failed to create payment plan" }, { status: 500 })
  }
}
