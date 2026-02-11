import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

/**
 * GET /api/ai/cashflow-forecast
 * Returns AI-generated cash flow forecast for the next 30 days.
 */
export async function GET(req: Request) {
  try {
    const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "ACCOUNTANT"])
    if (error || !hospitalId) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)
    const thirtyDaysAhead = new Date(now)
    thirtyDaysAhead.setDate(now.getDate() + 30)

    // Historical daily revenue (last 30 days)
    const payments = await prisma.payment.findMany({
      where: {
        hospitalId,
        paymentDate: { gte: thirtyDaysAgo, lte: now },
      },
      select: { amount: true, paymentDate: true, paymentMethod: true },
      orderBy: { paymentDate: "asc" },
    })

    // Group by date
    const dailyRevenue: Record<string, number> = {}
    for (const p of payments) {
      const key = p.paymentDate.toISOString().split("T")[0]
      dailyRevenue[key] = (dailyRevenue[key] || 0) + Number(p.amount)
    }

    // Upcoming appointments (next 30 days) with procedure estimates
    const upcomingAppts = await prisma.appointment.findMany({
      where: {
        hospitalId,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledDate: { gte: now, lte: thirtyDaysAhead },
      },
      select: { scheduledDate: true, appointmentType: true },
    })

    const apptsByDate: Record<string, number> = {}
    for (const a of upcomingAppts) {
      const key = a.scheduledDate.toISOString().split("T")[0]
      apptsByDate[key] = (apptsByDate[key] || 0) + 1
    }

    // Pending insurance claims
    const pendingClaims = await prisma.insuranceClaim.findMany({
      where: {
        hospitalId,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
      },
      select: { claimAmount: true, approvedAmount: true, status: true, submittedDate: true },
    })
    const totalPendingInsurance = pendingClaims.reduce(
      (sum, c) => sum + Number(c.approvedAmount || c.claimAmount || 0), 0
    )

    // Outstanding invoices
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        hospitalId,
        status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: { balanceAmount: true, dueDate: true, status: true },
    })
    const totalOutstanding = outstandingInvoices.reduce(
      (sum, inv) => sum + Number(inv.balanceAmount || 0), 0
    )

    // Payment plan installments due in next 30 days
    const upcomingInstallments = await prisma.paymentPlanSchedule.findMany({
      where: {
        plan: { hospitalId, status: "ACTIVE" },
        status: "PENDING",
        dueDate: { gte: now, lte: thirtyDaysAhead },
      },
      select: { amount: true, dueDate: true },
    })
    const installmentsByDate: Record<string, number> = {}
    for (const inst of upcomingInstallments) {
      const key = inst.dueDate.toISOString().split("T")[0]
      installmentsByDate[key] = (installmentsByDate[key] || 0) + Number(inst.amount)
    }

    // Calculate averages
    const revenueValues = Object.values(dailyRevenue)
    const avgDailyRevenue = revenueValues.length > 0
      ? Math.round(revenueValues.reduce((s, v) => s + v, 0) / revenueValues.length)
      : 0

    // Build context
    const contextData = {
      historicalDailyRevenue: dailyRevenue,
      avgDailyRevenue,
      upcomingAppointmentsByDate: apptsByDate,
      totalUpcomingAppointments: upcomingAppts.length,
      pendingInsuranceClaims: pendingClaims.length,
      totalPendingInsurance,
      totalOutstandingInvoices: totalOutstanding,
      overdueInvoices: outstandingInvoices.filter((i) => i.status === "OVERDUE").length,
      upcomingInstallments: installmentsByDate,
      avgRevenuePerAppointment: upcomingAppts.length > 0 && avgDailyRevenue > 0
        ? Math.round(avgDailyRevenue / (Object.values(apptsByDate).reduce((s, v) => s + v, 0) / 30 || 1))
        : 2000,
    }

    const model = getModelByTier("billing")
    const response = await complete(
      [
        {
          role: "system",
          content: `You are a cash flow forecasting AI for a dental clinic. Analyze financial data and project daily income for 30 days.
Return JSON: { dailyForecast: [{ date, projected, appointments, sources: { appointments, collections, insurance, paymentPlans } }], weeklyTotals: [{ week, projected, startDate, endDate }], summary: { total30Day, avgDaily, bestDay, worstDay, potentialShortfalls: string[], trend } }.
Consider weekday/weekend patterns. Flag shortfalls. Return ONLY valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Forecast cash flow for the next 30 days starting ${now.toISOString().split("T")[0]}:\n${JSON.stringify(contextData, null, 2)}`,
        },
      ],
      { ...model, maxTokens: 8192 }
    )

    let result: any
    try {
      const raw = extractJSON(response.content)
      result = JSON.parse(raw)
    } catch {
      // Fallback: simple projection
      const dailyForecast = []
      for (let i = 0; i < 30; i++) {
        const date = new Date(now)
        date.setDate(now.getDate() + i)
        const dateStr = date.toISOString().split("T")[0]
        const dayOfWeek = date.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const apptCount = apptsByDate[dateStr] || 0
        const planAmount = installmentsByDate[dateStr] || 0
        const projected = Math.round(
          (isWeekend ? avgDailyRevenue * 0.4 : avgDailyRevenue) + planAmount
        )
        dailyForecast.push({
          date: dateStr,
          projected,
          appointments: apptCount,
          sources: { appointments: projected - planAmount, collections: 0, insurance: 0, paymentPlans: planAmount },
        })
      }
      const total30Day = dailyForecast.reduce((s, d) => s + d.projected, 0)
      result = {
        dailyForecast,
        weeklyTotals: [],
        summary: {
          total30Day,
          avgDaily: Math.round(total30Day / 30),
          bestDay: "Monday",
          worstDay: "Sunday",
          potentialShortfalls: [],
          trend: "STABLE",
        },
      }
    }

    return NextResponse.json({ ...result, model: response.model })
  } catch (error: any) {
    console.error("Cash flow forecast error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate forecast" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 }
    )
  }
}
