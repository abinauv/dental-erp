import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

/**
 * GET /api/ai/patient-segments
 * Returns AI-generated patient segmentation with RFM analysis and churn prediction.
 */
export async function GET(req: Request) {
  try {
    const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR"])
    if (error || !hospitalId) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const now = new Date()
    const twelveMonthsAgo = new Date(now)
    twelveMonthsAgo.setMonth(now.getMonth() - 12)

    // Active patients
    const patients = await prisma.patient.findMany({
      where: { hospitalId, isActive: true },
      select: {
        id: true,
        patientId: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
      take: 200,
    })

    if (patients.length === 0) {
      return NextResponse.json({ patients: [], summary: {} })
    }

    const patientIds = patients.map((p) => p.id)

    // Last visit per patient
    const lastVisits = await prisma.appointment.findMany({
      where: {
        hospitalId,
        patientId: { in: patientIds },
        status: "COMPLETED",
      },
      orderBy: { scheduledDate: "desc" },
      distinct: ["patientId"],
      select: { patientId: true, scheduledDate: true },
    })
    const lastVisitMap = Object.fromEntries(lastVisits.map((v) => [v.patientId, v.scheduledDate]))

    // Appointment frequency (last 12 months)
    const frequency = await prisma.appointment.groupBy({
      by: ["patientId"],
      where: {
        hospitalId,
        patientId: { in: patientIds },
        status: "COMPLETED",
        scheduledDate: { gte: twelveMonthsAgo },
      },
      _count: { _all: true },
    })
    const freqMap = Object.fromEntries(frequency.map((f) => [f.patientId, f._count._all]))

    // Total spend (last 12 months) — aggregate via Invoice (Payment has no patientId)
    const invoiceSpend = await prisma.invoice.groupBy({
      by: ["patientId"],
      where: {
        hospitalId,
        patientId: { in: patientIds },
        createdAt: { gte: twelveMonthsAgo },
      },
      _sum: { paidAmount: true },
    })
    const spendMap = Object.fromEntries(invoiceSpend.map((inv) => [inv.patientId, Number(inv._sum?.paidAmount || 0)]))

    // Build context
    const contextData = patients.map((p) => {
      const lastVisit = lastVisitMap[p.id]
      const recency = lastVisit ? Math.round((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)) : 999
      return {
        patientId: p.id,
        displayId: p.patientId,
        name: `${p.firstName} ${p.lastName}`,
        registeredAt: p.createdAt.toISOString().split("T")[0],
        daysSinceRegistration: Math.round((now.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        lastVisit: lastVisit?.toISOString().split("T")[0] || null,
        recencyDays: recency,
        frequency12Months: freqMap[p.id] || 0,
        totalSpend12Months: spendMap[p.id] || 0,
      }
    })

    const model = getModelByTier("insights")
    const response = await complete(
      [
        {
          role: "system",
          content: `You are a patient segmentation AI for a dental clinic. Perform RFM analysis and churn prediction.
Return JSON: { patients: [{ patientId, rfm: { recency, frequency, monetary }, segment, churnRisk (0-100), churnLevel, recommendation }], summary: { vip, loyal, regular, atRisk, churning, new, avgChurnRisk, topRetentionActions: string[] } }.
Segments: VIP, LOYAL, REGULAR, AT_RISK, CHURNING, NEW. churnRisk: 0-30=LOW, 31-60=MEDIUM, 61-100=HIGH.
Return ONLY valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Segment these ${contextData.length} patients:\n${JSON.stringify(contextData, null, 2)}`,
        },
      ],
      { ...model, maxTokens: 8192 }
    )

    let result: any
    try {
      const raw = extractJSON(response.content)
      result = JSON.parse(raw)
    } catch {
      // Fallback: rule-based segmentation
      const segmented = contextData.map((p) => {
        let segment = "REGULAR"
        let churnRisk = 30
        if (p.daysSinceRegistration <= 90 && p.frequency12Months <= 1) {
          segment = "NEW"; churnRisk = 40
        } else if (p.recencyDays > 180) {
          segment = "CHURNING"; churnRisk = 80
        } else if (p.recencyDays > 90) {
          segment = "AT_RISK"; churnRisk = 55
        } else if (p.frequency12Months >= 4 && p.totalSpend12Months >= 10000) {
          segment = "VIP"; churnRisk = 10
        } else if (p.frequency12Months >= 4) {
          segment = "LOYAL"; churnRisk = 15
        }
        const churnLevel = churnRisk <= 30 ? "LOW" : churnRisk <= 60 ? "MEDIUM" : "HIGH"
        return {
          patientId: p.patientId,
          rfm: { recency: p.recencyDays, frequency: p.frequency12Months, monetary: p.totalSpend12Months },
          segment,
          churnRisk,
          churnLevel,
          recommendation: churnLevel === "HIGH" ? "Schedule recall appointment" : "Standard follow-up",
        }
      })
      const counts = { vip: 0, loyal: 0, regular: 0, atRisk: 0, churning: 0, new: 0 }
      for (const s of segmented) {
        const key = s.segment.toLowerCase().replace("_", "")
        if (key === "atrisk") counts.atRisk++
        else if (key in counts) counts[key as keyof typeof counts]++
      }
      result = {
        patients: segmented,
        summary: {
          ...counts,
          avgChurnRisk: Math.round(segmented.reduce((s, p) => s + p.churnRisk, 0) / segmented.length),
          topRetentionActions: ["Send recall reminders to at-risk patients", "Offer loyalty discounts", "Schedule birthday greetings"],
        },
      }
    }

    // Enrich with patient display info
    const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]))
    if (result.patients) {
      result.patients = result.patients.map((p: any) => {
        const patient = patientMap[p.patientId]
        return {
          ...p,
          displayId: patient?.patientId,
          name: patient ? `${patient.firstName} ${patient.lastName}` : undefined,
          phone: patient?.phone,
        }
      })
    }

    return NextResponse.json({ ...result, model: response.model })
  } catch (error: any) {
    console.error("Patient segmentation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate segments" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 }
    )
  }
}
