import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { complete } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

/**
 * GET /api/ai/briefing
 * Generates an AI-powered morning briefing for the authenticated ADMIN user.
 */
export async function GET() {
  const { error, user, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !user || !hospitalId) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  // 1. Today's appointments
  const todayAppts = await prisma.appointment.findMany({
    where: { hospitalId, scheduledDate: new Date(todayStr + "T00:00:00") },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { firstName: true, lastName: true } },
    },
    orderBy: { scheduledTime: "asc" },
  })

  // 2. Overdue invoices
  const overdueInvoices = await prisma.invoice.findMany({
    where: { hospitalId, status: "OVERDUE" },
    include: { patient: { select: { firstName: true, lastName: true } } },
    take: 5,
    orderBy: { createdAt: "asc" },
  })

  // 3. Low stock alerts
  const allItems = await prisma.inventoryItem.findMany({
    where: { hospitalId, isActive: true },
    select: { name: true, currentStock: true, reorderLevel: true, minimumStock: true, unit: true },
  })
  const lowStock = allItems.filter((i) => i.currentStock <= i.reorderLevel)

  // 4. Yesterday's revenue summary
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayInvoices = await prisma.invoice.findMany({
    where: {
      hospitalId,
      createdAt: { gte: yesterday, lt: today },
      status: { not: "CANCELLED" },
    },
    select: { totalAmount: true, paidAmount: true },
  })
  const yesterdayBilled = yesterdayInvoices.reduce((s, i) => s + Number(i.totalAmount), 0)
  const yesterdayCollected = yesterdayInvoices.reduce((s, i) => s + Number(i.paidAmount), 0)

  // 5. Patients with high risk scores
  const highRisk = await prisma.patientRiskScore.findMany({
    where: { hospitalId, overallScore: { gte: 61 } },
    include: { patient: { select: { firstName: true, lastName: true } } },
    orderBy: { overallScore: "desc" },
    take: 3,
  })

  // 6. Upcoming follow-ups overdue
  const overdueFollowUps = await prisma.treatment.findMany({
    where: {
      hospitalId,
      followUpRequired: true,
      followUpDate: { lt: today },
      status: "COMPLETED",
    },
    include: { patient: { select: { firstName: true, lastName: true } } },
    take: 5,
  })

  // Build the data payload for the AI
  const dataPayload = {
    date: todayStr,
    appointments: todayAppts.map((a) => ({
      time: a.scheduledTime,
      patient: `${a.patient.firstName} ${a.patient.lastName}`,
      doctor: `Dr. ${a.doctor.firstName} ${a.doctor.lastName}`,
      type: a.appointmentType,
    })),
    overdueInvoices: overdueInvoices.map((i) => ({
      invoiceNo: i.invoiceNo,
      patient: `${i.patient.firstName} ${i.patient.lastName}`,
      balance: Number(i.balanceAmount),
    })),
    lowStockItems: lowStock.map((i) => ({ name: i.name, stock: i.currentStock, unit: i.unit, reorderLevel: i.reorderLevel })),
    yesterdayRevenue: { billed: yesterdayBilled, collected: yesterdayCollected },
    highRiskPatients: highRisk.map((r) => ({
      patient: `${r.patient.firstName} ${r.patient.lastName}`,
      score: r.overallScore,
    })),
    overdueFollowUps: overdueFollowUps.map((t) => ({
      patient: `${t.patient.firstName} ${t.patient.lastName}`,
      followUpDate: t.followUpDate?.toISOString().split("T")[0],
    })),
  }

  const prompt = `You are generating a concise morning briefing for the clinic admin.

DATA:
${JSON.stringify(dataPayload, null, 2)}

Generate a structured daily briefing in this order:
1. 📋 Today's Schedule – list appointments with times
2. 💰 Yesterday's Revenue – billed vs collected with collection rate
3. ⚠️ Overdue Invoices – highlight top items needing follow-up
4. 📦 Inventory Alerts – any low/critical stock
5. 🏥 Clinical Flags – high-risk patients and overdue follow-ups
6. 🎯 Top Priority – single most important action for today

Keep it under 300 words. Use clear formatting.`

  try {
    const { content } = await complete(
      [{ role: "system", content: prompt }],
      getModelByTier("reports")
    )

    // Save as an insight
    await prisma.aIInsight.create({
      data: {
        hospitalId,
        category: "OPERATIONAL",
        severity: "INFO",
        title: `Morning Briefing – ${todayStr}`,
        description: content,
        data: dataPayload as any,
        expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    })

    return NextResponse.json({ briefing: content, generatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Briefing generation failed" },
      { status: 502 }
    )
  }
}
