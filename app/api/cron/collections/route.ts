import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/cron/collections
 * Scheduled: daily 10:00 IST
 *
 * 1) Identifies overdue invoices, classifies by escalation tier,
 *    and creates notifications for the appropriate staff.
 *
 * Escalation tiers:
 *   Tier 1 (3–6 days):   Notify receptionist – friendly reminder
 *   Tier 2 (7–13 days):  Notify accountant – email + WhatsApp follow-up
 *   Tier 3 (14–20 days): Assign to collections staff
 *   Tier 4 (21+ days):   Escalate to manager (ADMIN)
 *
 * 2) Payment plan installment reminders:
 *   - 3 days before due: reminder notification
 *   - On due date: due today notification
 *   - 3+ days overdue: overdue notification + mark installment as OVERDUE
 */
export async function GET(req: Request) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const hospitals = await prisma.hospital.findMany({
    where: { isActive: true, onboardingCompleted: true },
    select: { id: true },
  })

  const invoiceSummary: { hospitalId: string; tier1: number; tier2: number; tier3: number; tier4: number }[] = []
  const planSummary: { hospitalId: string; reminders: number; dueToday: number; markedOverdue: number }[] = []

  for (const hospital of hospitals) {
    // ── 1) Invoice Collection Escalation ──
    const overdueInvoices = await prisma.invoice.findMany({
      where: { hospitalId: hospital.id, status: "OVERDUE" },
      include: { patient: { select: { firstName: true, lastName: true } } },
    })

    const tiers = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 }

    for (const invoice of overdueInvoices) {
      const daysOverdue = Math.floor((now.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24))

      let tier: string
      let notifyRole: string
      let message: string

      if (daysOverdue >= 21) {
        tier = "tier4"
        notifyRole = "ADMIN"
        message = `ESCALATION: Invoice ${invoice.invoiceNo} for ${invoice.patient.firstName} ${invoice.patient.lastName} is ${daysOverdue} days overdue (₹${Number(invoice.balanceAmount).toLocaleString("en-IN")}). Requires manager attention.`
      } else if (daysOverdue >= 14) {
        tier = "tier3"
        notifyRole = "ACCOUNTANT"
        message = `Collections follow-up needed: Invoice ${invoice.invoiceNo} for ${invoice.patient.firstName} ${invoice.patient.lastName} is ${daysOverdue} days overdue.`
      } else if (daysOverdue >= 7) {
        tier = "tier2"
        notifyRole = "ACCOUNTANT"
        message = `Payment reminder needed: Invoice ${invoice.invoiceNo} for ${invoice.patient.firstName} ${invoice.patient.lastName} – ${daysOverdue} days overdue.`
      } else if (daysOverdue >= 3) {
        tier = "tier1"
        notifyRole = "RECEPTIONIST"
        message = `Friendly reminder: Invoice ${invoice.invoiceNo} for ${invoice.patient.firstName} ${invoice.patient.lastName} is due (${daysOverdue} days).`
      } else {
        continue
      }

      tiers[tier as keyof typeof tiers]++

      const targetUser = await prisma.user.findFirst({
        where: { hospitalId: hospital.id, role: notifyRole as any, isActive: true },
        select: { id: true },
      })

      if (targetUser) {
        await prisma.notification.create({
          data: {
            hospitalId: hospital.id,
            userId: targetUser.id,
            title: `Payment Collection – Tier ${tier.slice(-1)}`,
            message,
            type: "PAYMENT",
            entityType: "Invoice",
            entityId: invoice.id,
          },
        })
      }
    }

    invoiceSummary.push({ hospitalId: hospital.id, ...tiers })

    // ── 2) Payment Plan Installment Reminders ──
    const planStats = { reminders: 0, dueToday: 0, markedOverdue: 0 }

    // Find active payment plans for this hospital
    const activePlans = await prisma.paymentPlan.findMany({
      where: { hospitalId: hospital.id, status: "ACTIVE" },
      include: {
        schedules: {
          where: { status: { in: ["PENDING", "OVERDUE"] } },
          orderBy: { dueDate: "asc" },
        },
        patient: { select: { firstName: true, lastName: true } },
        invoice: { select: { invoiceNo: true } },
      },
    })

    for (const plan of activePlans) {
      for (const schedule of plan.schedules) {
        const dueDate = new Date(schedule.dueDate)
        dueDate.setHours(0, 0, 0, 0)

        const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

        // 3 days before due — send reminder
        if (daysDiff === -3) {
          planStats.reminders++
          const accountant = await prisma.user.findFirst({
            where: { hospitalId: hospital.id, role: { in: ["ACCOUNTANT", "ADMIN"] as any }, isActive: true },
            select: { id: true },
          })
          if (accountant) {
            await prisma.notification.create({
              data: {
                hospitalId: hospital.id,
                userId: accountant.id,
                title: "Installment Due Soon",
                message: `Payment plan installment #${schedule.installmentNo} for ${plan.patient.firstName} ${plan.patient.lastName} (Invoice ${plan.invoice.invoiceNo}) — ₹${Number(schedule.amount).toLocaleString("en-IN")} due in 3 days.`,
                type: "PAYMENT",
                entityType: "PaymentPlan",
                entityId: plan.id,
              },
            })
          }
        }

        // On due date
        if (daysDiff === 0) {
          planStats.dueToday++
          const accountant = await prisma.user.findFirst({
            where: { hospitalId: hospital.id, role: { in: ["ACCOUNTANT", "ADMIN"] as any }, isActive: true },
            select: { id: true },
          })
          if (accountant) {
            await prisma.notification.create({
              data: {
                hospitalId: hospital.id,
                userId: accountant.id,
                title: "Installment Due Today",
                message: `Payment plan installment #${schedule.installmentNo} for ${plan.patient.firstName} ${plan.patient.lastName} (Invoice ${plan.invoice.invoiceNo}) — ₹${Number(schedule.amount).toLocaleString("en-IN")} is due today.`,
                type: "PAYMENT",
                entityType: "PaymentPlan",
                entityId: plan.id,
              },
            })
          }
        }

        // 3+ days overdue — mark as OVERDUE and send escalation
        if (daysDiff >= 3 && schedule.status === "PENDING") {
          planStats.markedOverdue++

          await prisma.paymentPlanSchedule.update({
            where: { id: schedule.id },
            data: { status: "OVERDUE" },
          })

          const admin = await prisma.user.findFirst({
            where: { hospitalId: hospital.id, role: "ADMIN" as any, isActive: true },
            select: { id: true },
          })
          if (admin) {
            await prisma.notification.create({
              data: {
                hospitalId: hospital.id,
                userId: admin.id,
                title: "Installment Overdue",
                message: `Payment plan installment #${schedule.installmentNo} for ${plan.patient.firstName} ${plan.patient.lastName} (Invoice ${plan.invoice.invoiceNo}) — ₹${Number(schedule.amount).toLocaleString("en-IN")} is ${daysDiff} days overdue.`,
                type: "PAYMENT",
                entityType: "PaymentPlan",
                entityId: plan.id,
              },
            })
          }
        }
      }

      // Check if plan has too many overdue installments (3+) → mark as DEFAULTED
      const overdueCount = await prisma.paymentPlanSchedule.count({
        where: { planId: plan.id, status: "OVERDUE" },
      })
      if (overdueCount >= 3 && plan.status === "ACTIVE") {
        await prisma.paymentPlan.update({
          where: { id: plan.id },
          data: { status: "DEFAULTED" },
        })
      }
    }

    planSummary.push({ hospitalId: hospital.id, ...planStats })
  }

  return NextResponse.json({
    invoiceCollections: invoiceSummary,
    paymentPlanReminders: planSummary,
    processedAt: now.toISOString(),
  })
}
