import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/cron/recall
 * Scheduled: weekly (Monday 07:00 IST)
 * Identifies patients who need to be recalled:
 *   1. No visit in 6+ months
 *   2. Incomplete treatment plans
 *   3. Overdue follow-ups
 * Creates AIInsight records and notifications for ADMIN.
 */
export async function GET(req: Request) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(now.getMonth() - 6)

  const hospitals = await prisma.hospital.findMany({
    where: { isActive: true, onboardingCompleted: true },
    select: { id: true },
  })

  const results: { hospitalId: string; noVisit: number; incomplete: number; overdueFollowUp: number }[] = []

  for (const hospital of hospitals) {
    // 1. Patients with no appointment in 6+ months
    const activePatients = await prisma.patient.findMany({
      where: { hospitalId: hospital.id, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    })

    const patientsWithRecentVisit = new Set(
      (
        await prisma.appointment.findMany({
          where: { hospitalId: hospital.id, scheduledDate: { gte: sixMonthsAgo }, status: "COMPLETED" },
          select: { patientId: true },
        })
      ).map((a) => a.patientId)
    )

    const noVisitPatients = activePatients.filter((p) => !patientsWithRecentVisit.has(p.id))

    // 2. Incomplete treatment plans (DRAFT, PROPOSED, IN_PROGRESS older than 60 days)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(now.getDate() - 60)
    const incompleteTP = await prisma.treatmentPlan.findMany({
      where: {
        hospitalId: hospital.id,
        status: { in: ["DRAFT", "PROPOSED", "IN_PROGRESS"] },
        createdAt: { lt: sixtyDaysAgo },
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    })

    // 3. Overdue follow-ups
    const overdueFollowUps = await prisma.treatment.findMany({
      where: {
        hospitalId: hospital.id,
        followUpRequired: true,
        followUpDate: { lt: now },
        status: "COMPLETED",
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    })

    // Create recall insight
    if (noVisitPatients.length > 0 || incompleteTP.length > 0 || overdueFollowUps.length > 0) {
      const description = [
        noVisitPatients.length > 0 && `${noVisitPatients.length} patient(s) not visited in 6+ months`,
        incompleteTP.length > 0 && `${incompleteTP.length} incomplete treatment plan(s)`,
        overdueFollowUps.length > 0 && `${overdueFollowUps.length} overdue follow-up(s)`,
      ]
        .filter(Boolean)
        .join("; ")

      await prisma.aiInsight.create({
        data: {
          hospitalId: hospital.id,
          category: "PATIENT",
          severity: noVisitPatients.length > 10 ? "WARNING" : "INFO",
          title: "Patient Recall Required",
          description,
          data: {
            noVisitPatients: noVisitPatients.slice(0, 10).map((p) => `${p.firstName} ${p.lastName}`),
            incompleteTP: incompleteTP.slice(0, 5).map((tp) => `${tp.patient.firstName} ${tp.patient.lastName} – ${tp.title}`),
            overdueFollowUps: overdueFollowUps.slice(0, 5).map((t) => `${t.patient.firstName} ${t.patient.lastName}`),
          } as any,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      // Notify ADMIN
      const admin = await prisma.user.findFirst({
        where: { hospitalId: hospital.id, role: "ADMIN", isActive: true },
        select: { id: true },
      })
      if (admin) {
        await prisma.notification.create({
          data: {
            hospitalId: hospital.id,
            userId: admin.id,
            title: "Weekly Patient Recall",
            message: description,
            type: "PATIENT" as any,
            entityType: "AIInsight",
            entityId: "recall",
          },
        })
      }
    }

    results.push({
      hospitalId: hospital.id,
      noVisit: noVisitPatients.length,
      incomplete: incompleteTP.length,
      overdueFollowUp: overdueFollowUps.length,
    })
  }

  return NextResponse.json({ results, processedAt: now.toISOString() })
}
