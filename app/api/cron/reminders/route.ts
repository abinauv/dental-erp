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

  let created = 0
  for (const appt of appointments) {
    // Skip if already has a pending/sent reminder
    const hasPending = appt.reminders.some((r) => r.status === "PENDING" || r.status === "SENT")
    if (hasPending) continue

    // Determine channel — default to SMS
    const channel = "SMS"

    await prisma.appointmentReminder.create({
      data: {
        appointmentId: appt.id,
        reminderType: channel as any,
        scheduledFor: new Date(appt.scheduledDate.getTime() - 60 * 60 * 1000), // 1 hour before
        status: "PENDING",
      },
    })
    created++
  }

  return NextResponse.json({
    checked: appointments.length,
    created,
    processedAt: now.toISOString(),
  })
}
