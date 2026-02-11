import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

/**
 * GET /api/ai/no-show-risk
 * Returns no-show risk scores for upcoming appointments.
 * Query params: days (default 7), doctorId (optional)
 */
export async function GET(req: Request) {
  try {
    const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    if (error || !hospitalId) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const days = Math.min(parseInt(searchParams.get("days") || "7"), 30)
    const doctorId = searchParams.get("doctorId")

    const now = new Date()
    const endDate = new Date(now)
    endDate.setDate(now.getDate() + days)

    // Fetch upcoming appointments
    const where: any = {
      hospitalId,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      scheduledDate: { gte: now, lte: endDate },
    }
    if (doctorId) where.doctorId = doctorId

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true },
        },
        doctor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { scheduledDate: "asc" },
      take: 50,
    })

    if (appointments.length === 0) {
      return NextResponse.json({ predictions: [], count: 0 })
    }

    // Gather patient history for each unique patient
    const patientIds = [...new Set(appointments.map((a) => a.patientId))]
    const histories = await prisma.appointment.groupBy({
      by: ["patientId", "status"],
      where: {
        hospitalId,
        patientId: { in: patientIds },
        scheduledDate: { lt: now },
      },
      _count: { _all: true },
    })

    // Build history map
    const historyMap: Record<string, { total: number; noShows: number; cancelled: number; lastVisit?: string }> = {}
    for (const h of histories) {
      if (!historyMap[h.patientId]) {
        historyMap[h.patientId] = { total: 0, noShows: 0, cancelled: 0 }
      }
      const count = h._count._all
      historyMap[h.patientId].total += count
      if (h.status === "NO_SHOW") historyMap[h.patientId].noShows += count
      if (h.status === "CANCELLED") historyMap[h.patientId].cancelled += count
    }

    // Get last visit date for each patient
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
    for (const lv of lastVisits) {
      if (historyMap[lv.patientId]) {
        historyMap[lv.patientId].lastVisit = lv.scheduledDate.toISOString()
      }
    }

    // Build context for AI
    const contextData = appointments.map((appt) => {
      const hist = historyMap[appt.patientId] || { total: 0, noShows: 0, cancelled: 0 }
      const noShowRate = hist.total > 0 ? Math.round((hist.noShows / hist.total) * 100) : null
      return {
        appointmentId: appt.id,
        patientName: `${appt.patient.firstName} ${appt.patient.lastName}`,
        scheduledDate: appt.scheduledDate.toISOString().split("T")[0],
        scheduledTime: appt.scheduledTime,
        appointmentType: appt.appointmentType,
        status: appt.status,
        dayOfWeek: appt.scheduledDate.toLocaleDateString("en-US", { weekday: "long" }),
        pastAppointments: hist.total,
        pastNoShows: hist.noShows,
        pastCancellations: hist.cancelled,
        noShowRate: noShowRate !== null ? `${noShowRate}%` : "No history",
        lastVisit: hist.lastVisit || "Never",
        patientSince: appt.patient.createdAt.toISOString().split("T")[0],
      }
    })

    const model = getModelByTier("insights")
    const response = await complete(
      [
        {
          role: "system",
          content: `You are a no-show prediction AI. Analyze appointment data and return risk scores as JSON array.
For each appointment return: { appointmentId, riskScore (0-100), riskLevel (LOW/MEDIUM/HIGH), factors (max 3 strings), recommendation (string) }.
Score ranges: 0-30=LOW, 31-70=MEDIUM, 71-100=HIGH.
Use patient history as primary factor. Return ONLY valid JSON array, no markdown.`,
        },
        {
          role: "user",
          content: `Analyze these upcoming appointments for no-show risk:\n${JSON.stringify(contextData, null, 2)}`,
        },
      ],
      model
    )

    let predictions: any[] = []
    try {
      const raw = extractJSON(response.content)
      predictions = JSON.parse(raw)
    } catch {
      // Fallback: use simple heuristic
      predictions = appointments.map((appt) => {
        const hist = historyMap[appt.patientId] || { total: 0, noShows: 0, cancelled: 0 }
        const noShowRate = hist.total > 0 ? (hist.noShows / hist.total) * 100 : 0
        let riskScore = appt.status === "CONFIRMED" ? 15 : 35
        riskScore += noShowRate * 0.5
        if (!hist.lastVisit) riskScore += 10
        riskScore = Math.min(100, Math.round(riskScore))
        const riskLevel = riskScore <= 30 ? "LOW" : riskScore <= 70 ? "MEDIUM" : "HIGH"
        return {
          appointmentId: appt.id,
          riskScore,
          riskLevel,
          factors: noShowRate > 0 ? [`${Math.round(noShowRate)}% historical no-show rate`] : ["New patient or limited history"],
          recommendation: riskLevel === "HIGH" ? "Send extra reminder and call to confirm" : "Standard reminder",
        }
      })
    }

    // Merge predictions with appointment data
    const enriched = predictions.map((pred: any) => {
      const appt = appointments.find((a) => a.id === pred.appointmentId)
      return {
        ...pred,
        patient: appt?.patient,
        doctor: appt?.doctor,
        scheduledDate: appt?.scheduledDate,
        scheduledTime: appt?.scheduledTime,
        appointmentType: appt?.appointmentType,
        status: appt?.status,
      }
    })

    return NextResponse.json({
      predictions: enriched,
      count: enriched.length,
      highRiskCount: enriched.filter((p: any) => p.riskLevel === "HIGH").length,
      model: response.model,
    })
  } catch (error: any) {
    console.error("No-show risk error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate predictions" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 }
    )
  }
}
