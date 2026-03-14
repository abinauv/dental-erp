import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/cron/reminders
 * Scheduled: every hour
 * Finds appointments in the next 24 hours that have no reminder sent,
 * creates AppointmentReminder records.
 * Actual SMS/Email/WhatsApp dispatch would be handled by your communication service.
 */
export async function GET(req: Request) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Find appointments in next 24 hours across all active hospitals
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      scheduledDate: { gte: now, lte: in24Hours },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      reminders: true,
    },
  })

  // Gather no-show history for risk assessment
  const patientIds = [...new Set(appointments.map((a) => a.patientId))]
  const noShowCounts = await prisma.appointment.groupBy({
    by: ["patientId"],
    where: {
      patientId: { in: patientIds },
      status: "NO_SHOW",
    },
    _count: true,
  })
  const totalCounts = await prisma.appointment.groupBy({
    by: ["patientId"],
    where: {
      patientId: { in: patientIds },
      scheduledDate: { lt: now },
    },
    _count: true,
  })
  const noShowMap: Record<string, number> = {}
  const totalMap: Record<string, number> = {}
  for (const ns of noShowCounts) noShowMap[ns.patientId] = ns._count
  for (const t of totalCounts) totalMap[t.patientId] = t._count

  let created = 0
  let extraReminders = 0
  for (const appt of appointments) {
    // Skip if already has a pending/sent reminder
    const hasPending = appt.reminders.some((r) => r.status === "PENDING" || r.status === "SENT")
    if (hasPending) continue

    // Determine channel — default to SMS
    const channel = "SMS"

    // Assess no-show risk: high if >30% no-show rate with at least 2 past appointments
    const total = totalMap[appt.patientId] || 0
    const noShows = noShowMap[appt.patientId] || 0
    const isHighRisk = total >= 2 && (noShows / total) > 0.3

    await prisma.appointmentReminder.create({
      data: {
        appointmentId: appt.id,
        reminderType: channel as any,
        scheduledFor: new Date(appt.scheduledDate.getTime() - 60 * 60 * 1000), // 1 hour before
        status: "PENDING",
      },
    })
    created++

    // High-risk patients get an extra early reminder (3 hours before)
    if (isHighRisk) {
      await prisma.appointmentReminder.create({
        data: {
          appointmentId: appt.id,
          reminderType: channel as any,
          scheduledFor: new Date(appt.scheduledDate.getTime() - 3 * 60 * 60 * 1000),
          status: "PENDING",
        },
      })
      extraReminders++
    }
  }

  return NextResponse.json({
    checked: appointments.length,
    created,
    extraReminders,
    processedAt: now.toISOString(),
  })
}
