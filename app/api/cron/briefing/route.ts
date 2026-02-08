import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { complete } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

/**
 * GET /api/cron/briefing
 * Scheduled: daily 07:30 IST
 * Generates morning briefings for all hospitals and creates notifications for ADMIN users.
 * Secured via CRON_SECRET header.
 */
export async function GET(req: Request) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hospitals = await prisma.hospital.findMany({
    where: { isActive: true, onboardingCompleted: true },
    select: { id: true, name: true },
  })

  const results: { hospitalId: string; status: string }[] = []

  for (const hospital of hospitals) {
    try {
      const today = new Date()
      const todayStr = today.toISOString().split("T")[0]

      // Gather data
      const [appointments, overdueInvoices, lowStock, highRisk, overdueFollowUps] = await Promise.all([
        prisma.appointment.findMany({
          where: { hospitalId: hospital.id, scheduledDate: new Date(todayStr + "T00:00:00") },
          include: {
            patient: { select: { firstName: true, lastName: true } },
            doctor: { select: { firstName: true, lastName: true } },
          },
          orderBy: { scheduledTime: "asc" },
        }),
        prisma.invoice.findMany({
          where: { hospitalId: hospital.id, status: "OVERDUE" },
          include: { patient: { select: { firstName: true, lastName: true } } },
          take: 5,
        }),
        prisma.inventoryItem.findMany({
          where: { hospitalId: hospital.id, isActive: true },
          select: { name: true, currentStock: true, reorderLevel: true, unit: true },
        }).then((items) => items.filter((i) => i.currentStock <= i.reorderLevel)),
        prisma.patientRiskScore.findMany({
          where: { hospitalId: hospital.id, overallScore: { gte: 61 } },
          include: { patient: { select: { firstName: true, lastName: true } } },
          orderBy: { overallScore: "desc" },
          take: 3,
        }),
        prisma.treatment.findMany({
          where: {
            hospitalId: hospital.id,
            followUpRequired: true,
            followUpDate: { lt: today },
            status: "COMPLETED",
          },
          include: { patient: { select: { firstName: true, lastName: true } } },
          take: 5,
        }),
      ])

      const dataPayload = {
        date: todayStr,
        appointments: appointments.map((a) => ({
          time: a.scheduledTime,
          patient: `${a.patient.firstName} ${a.patient.lastName}`,
          doctor: `Dr. ${a.doctor.firstName}`,
          type: a.appointmentType,
        })),
        overdueInvoices: overdueInvoices.map((i) => ({
          patient: `${i.patient.firstName} ${i.patient.lastName}`,
          balance: Number(i.balanceAmount),
        })),
        lowStock: lowStock.map((i) => ({ name: i.name, stock: i.currentStock, unit: i.unit })),
        highRiskPatients: highRisk.map((r) => ({ patient: `${r.patient.firstName} ${r.patient.lastName}`, score: r.overallScore })),
        overdueFollowUps: overdueFollowUps.map((t) => ({ patient: `${t.patient.firstName} ${t.patient.lastName}` })),
      }

      const { content } = await complete(
        [
          {
            role: "system",
            content: `Generate a concise daily briefing for ${hospital.name} based on the data below. Use clear formatting with emojis.\n\nDATA:\n${JSON.stringify(dataPayload, null, 2)}\n\nStructure: Schedule → Revenue → Overdue → Stock → Clinical Flags → Top Priority. Under 250 words.`,
          },
        ],
        getModelByTier("reports")
      )

      // Save as insight
      await prisma.aIInsight.create({
        data: {
          hospitalId: hospital.id,
          category: "OPERATIONAL",
          severity: "INFO",
          title: `Morning Briefing – ${todayStr}`,
          description: content,
          data: dataPayload as any,
          expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      })

      // Notify ADMIN users
      const admins = await prisma.user.findMany({
        where: { hospitalId: hospital.id, role: "ADMIN", isActive: true },
        select: { id: true },
      })
      await Promise.all(
        admins.map((admin) =>
          prisma.notification.create({
            data: {
              hospitalId: hospital.id,
              userId: admin.id,
              title: `Morning Briefing – ${todayStr}`,
              message: content,
              type: "INFO",
              entityType: "AIInsight",
              entityId: "briefing",
            },
          })
        )
      )

      results.push({ hospitalId: hospital.id, status: "ok" })
    } catch (err) {
      results.push({ hospitalId: hospital.id, status: err instanceof Error ? err.message : "error" })
    }
  }

  return NextResponse.json({ results, processedAt: new Date().toISOString() })
}
