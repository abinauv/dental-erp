import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/cron/collections
 * Scheduled: daily 10:00 IST
 * Identifies overdue invoices, classifies by escalation tier,
 * and creates notifications for the appropriate staff.
 *
 * Escalation tiers:
 *   Tier 1 (3–6 days):   Notify receptionist – friendly reminder
 *   Tier 2 (7–13 days):  Notify accountant – email + WhatsApp follow-up
 *   Tier 3 (14–20 days): Assign to collections staff
 *   Tier 4 (21+ days):   Escalate to manager (ADMIN)
 */
export async function GET(req: Request) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const hospitals = await prisma.hospital.findMany({
    where: { isActive: true, onboardingCompleted: true },
    select: { id: true },
  })

  const summary: { hospitalId: string; tier1: number; tier2: number; tier3: number; tier4: number }[] = []

  for (const hospital of hospitals) {
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
        continue // not overdue enough to notify
      }

      tiers[tier as keyof typeof tiers]++

      // Find a user with the appropriate role to notify
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

    summary.push({ hospitalId: hospital.id, ...tiers })
  }

  return NextResponse.json({ summary, processedAt: now.toISOString() })
}
