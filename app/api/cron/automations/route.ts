import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/cron/automations
 * Scheduled: daily
 * Evaluates all active marketing automation rules across all hospitals.
 * Secured via CRON_SECRET Bearer token.
 *
 * Trigger types:
 *  - NO_VISIT: patients with no visit in X days
 *  - BIRTHDAY_UPCOMING: patients whose birthday is in X days
 *  - TREATMENT_PLAN_PENDING: patients with open treatment plans older than X days
 *  - MEMBERSHIP_EXPIRING: memberships expiring in X days
 *  - POST_APPOINTMENT: patients who completed an appointment yesterday
 *  - PAYMENT_OVERDUE: invoices overdue by X days
 */
export async function POST(req: Request) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const automations = await prisma.marketingAutomation.findMany({
    where: { isActive: true },
  })

  const now = new Date()
  let totalTriggered = 0
  const results: Array<{ automationId: string; name: string; matched: number; action: string }> = []

  for (const auto of automations) {
    const trigger = auto.trigger as { type: string; params: Record<string, number | string> }
    const action = auto.action as { type: string; params: Record<string, string> }
    let matchedPatientIds: string[] = []

    try {
      switch (trigger.type) {
        case "NO_VISIT": {
          const days = Number(trigger.params.days) || 180
          const cutoff = new Date(now.getTime() - days * 86400000)
          // Find patients whose last appointment is before the cutoff
          const patients = await prisma.patient.findMany({
            where: {
              hospitalId: auto.hospitalId,
              isActive: true,
              appointments: {
                every: { scheduledDate: { lt: cutoff } },
              },
            },
            select: { id: true },
            take: 100,
          })
          matchedPatientIds = patients.map((p) => p.id)
          break
        }

        case "BIRTHDAY_UPCOMING": {
          const daysAhead = Number(trigger.params.days) || 3
          const targetDate = new Date(now.getTime() + daysAhead * 86400000)
          const targetMonth = targetDate.getMonth() + 1
          const targetDay = targetDate.getDate()
          // Find patients with birthdays matching the target date
          const patients = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT id FROM Patient WHERE hospitalId = ? AND isActive = 1 AND MONTH(dateOfBirth) = ? AND DAY(dateOfBirth) = ?`,
            auto.hospitalId,
            targetMonth,
            targetDay
          )
          matchedPatientIds = patients.map((p) => p.id)
          break
        }

        case "TREATMENT_PLAN_PENDING": {
          const days = Number(trigger.params.days) || 14
          const cutoff = new Date(now.getTime() - days * 86400000)
          const treatments = await prisma.treatment.findMany({
            where: {
              hospitalId: auto.hospitalId,
              status: "PLANNED",
              createdAt: { lt: cutoff },
            },
            select: { patientId: true },
            distinct: ["patientId"],
            take: 100,
          })
          matchedPatientIds = treatments.map((t) => t.patientId)
          break
        }

        case "MEMBERSHIP_EXPIRING": {
          const days = Number(trigger.params.days) || 7
          const futureDate = new Date(now.getTime() + days * 86400000)
          const memberships = await prisma.patientMembership.findMany({
            where: {
              status: "ACTIVE",
              endDate: { gte: now, lte: futureDate },
              patient: { hospitalId: auto.hospitalId },
            },
            select: { patientId: true },
            take: 100,
          })
          matchedPatientIds = memberships.map((m) => m.patientId)
          break
        }

        case "POST_APPOINTMENT": {
          const yesterday = new Date(now.getTime() - 86400000)
          const dayBefore = new Date(now.getTime() - 2 * 86400000)
          const appointments = await prisma.appointment.findMany({
            where: {
              hospitalId: auto.hospitalId,
              status: "COMPLETED",
              scheduledDate: { gte: dayBefore, lt: yesterday },
            },
            select: { patientId: true },
            distinct: ["patientId"],
            take: 100,
          })
          matchedPatientIds = appointments.map((a) => a.patientId)
          break
        }

        case "PAYMENT_OVERDUE": {
          const days = Number(trigger.params.days) || 30
          const cutoff = new Date(now.getTime() - days * 86400000)
          const invoices = await prisma.invoice.findMany({
            where: {
              hospitalId: auto.hospitalId,
              status: { in: ["PENDING", "OVERDUE"] },
              dueDate: { lt: cutoff },
            },
            select: { patientId: true },
            distinct: ["patientId"],
            take: 100,
          })
          matchedPatientIds = invoices.map((i) => i.patientId)
          break
        }
      }

      // Execute action for matched patients
      if (matchedPatientIds.length > 0) {
        switch (action.type) {
          case "SEND_SMS": {
            const templateId = action.params.templateId
            if (!templateId) break
            const template = await prisma.communicationTemplate.findFirst({
              where: { id: templateId, hospitalId: auto.hospitalId },
            })
            if (!template) break

            const patients = await prisma.patient.findMany({
              where: { id: { in: matchedPatientIds } },
              select: { id: true, firstName: true, lastName: true, phone: true },
            })

            for (const patient of patients) {
              if (!patient.phone) continue
              const message = template.content
                .replace(/\{\{patientName\}\}/g, `${patient.firstName} ${patient.lastName}`)
                .replace(/\{\{firstName\}\}/g, patient.firstName)

              await prisma.sMSLog.create({
                data: {
                  hospitalId: auto.hospitalId,
                  patientId: patient.id,
                  phone: patient.phone,
                  templateId,
                  message,
                  status: "PENDING",
                },
              })
            }
            break
          }

          case "SEND_EMAIL": {
            const templateId = action.params.templateId
            if (!templateId) break
            const template = await prisma.communicationTemplate.findFirst({
              where: { id: templateId, hospitalId: auto.hospitalId },
            })
            if (!template) break

            const patients = await prisma.patient.findMany({
              where: { id: { in: matchedPatientIds }, email: { not: null } },
              select: { id: true, firstName: true, lastName: true, email: true },
            })

            for (const patient of patients) {
              if (!patient.email) continue
              const body = template.content
                .replace(/\{\{patientName\}\}/g, `${patient.firstName} ${patient.lastName}`)
                .replace(/\{\{firstName\}\}/g, patient.firstName)
              const subject = (template.subject || template.name)
                .replace(/\{\{patientName\}\}/g, `${patient.firstName} ${patient.lastName}`)

              await prisma.emailLog.create({
                data: {
                  hospitalId: auto.hospitalId,
                  patientId: patient.id,
                  email: patient.email,
                  templateId,
                  subject,
                  body,
                  status: "PENDING",
                },
              })
            }
            break
          }

          case "CREATE_NOTIFICATION": {
            // Create in-app notifications (via AuditLog as notification mechanism)
            for (const patientId of matchedPatientIds) {
              await prisma.notification.create({
                data: {
                  hospitalId: auto.hospitalId,
                  userId: action.params.userId || "",
                  title: action.params.title || auto.name,
                  message: action.params.message || `Automation "${auto.name}" triggered for patient`,
                  type: "SYSTEM",
                  entityType: "Patient",
                  entityId: patientId,
                },
              })
            }
            break
          }
        }

        totalTriggered += matchedPatientIds.length
      }

      // Update automation stats
      await prisma.marketingAutomation.update({
        where: { id: auto.id },
        data: {
          lastRunAt: now,
          runCount: { increment: 1 },
        },
      })

      results.push({
        automationId: auto.id,
        name: auto.name,
        matched: matchedPatientIds.length,
        action: action.type,
      })
    } catch (err) {
      console.error(`Automation ${auto.id} (${auto.name}) failed:`, err)
      results.push({
        automationId: auto.id,
        name: auto.name,
        matched: 0,
        action: "ERROR",
      })
    }
  }

  return NextResponse.json({
    evaluated: automations.length,
    totalTriggered,
    results,
    processedAt: now.toISOString(),
  })
}
