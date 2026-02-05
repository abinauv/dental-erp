/**
 * Assembles runtime context for AI prompts by querying the database.
 */

import { prisma } from "@/lib/prisma"

export interface AIContext {
  hospital: { id: string; name: string; plan: string }
  user: { id: string; name: string; role: string }
  patient?: {
    id: string
    patientId: string
    name: string
    age?: number | null
    gender?: string | null
    medicalFlags: string[]
    currentMedications?: string | null
    outstandingBalance: number
    treatmentPlans: { title: string; status: string }[]
    recentVisits: { date: string; type: string }[]
    riskScore?: number
  }
  currentPage?: string
}

export async function buildContext(params: {
  hospitalId: string
  userId: string
  userName: string
  userRole: string
  hospitalName: string
  hospitalPlan: string
  patientId?: string | null
  currentPage?: string
}): Promise<AIContext> {
  const ctx: AIContext = {
    hospital: { id: params.hospitalId, name: params.hospitalName, plan: params.hospitalPlan },
    user: { id: params.userId, name: params.userName, role: params.userRole },
    currentPage: params.currentPage,
  }

  if (params.patientId) {
    const patient = await prisma.patient.findUnique({
      where: { id: params.patientId, hospitalId: params.hospitalId },
      include: {
        medicalHistory: true,
        treatmentPlans: { orderBy: { createdAt: "desc" }, take: 5 },
        appointments: {
          where: { status: { in: ["COMPLETED"] } },
          orderBy: { scheduledDate: "desc" },
          take: 5,
        },
        invoices: {
          where: { status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } },
        },
      },
    })

    if (patient) {
      const flags: string[] = []
      if (patient.medicalHistory) {
        const h = patient.medicalHistory
        if (h.drugAllergies) flags.push(`Allergy: ${h.drugAllergies}`)
        if (h.hasDiabetes) flags.push("Diabetes" + (h.diabetesType ? ` (${h.diabetesType})` : ""))
        if (h.hasHypertension) flags.push("Hypertension")
        if (h.hasHeartDisease) flags.push("Heart Disease")
        if (h.hasHepatitis) flags.push("Hepatitis" + (h.hepatitisType ? ` (${h.hepatitisType})` : ""))
        if (h.hasHiv) flags.push("HIV+")
        if (h.hasEpilepsy) flags.push("Epilepsy")
        if (h.isPregnant) flags.push(`Pregnant${h.pregnancyWeeks ? ` (${h.pregnancyWeeks}w)` : ""}`)
        if (h.hasBleedingDisorder) flags.push("Bleeding Disorder")
      }

      ctx.patient = {
        id: patient.id,
        patientId: patient.patientId,
        name: `${patient.firstName} ${patient.lastName}`,
        age: patient.age,
        gender: patient.gender,
        medicalFlags: flags,
        currentMedications: patient.medicalHistory?.currentMedications,
        outstandingBalance: patient.invoices.reduce(
          (sum, inv) => sum + Number(inv.balanceAmount),
          0
        ),
        treatmentPlans: patient.treatmentPlans.map((tp) => ({
          title: tp.title,
          status: tp.status,
        })),
        recentVisits: patient.appointments.map((a) => ({
          date: a.scheduledDate.toISOString().split("T")[0],
          type: a.appointmentType,
        })),
      }

      // Fetch latest risk score
      const risk = await prisma.patientRiskScore.findFirst({
        where: { patientId: patient.id },
        orderBy: { calculatedAt: "desc" },
      })
      if (risk) ctx.patient.riskScore = risk.overallScore
    }
  }

  return ctx
}

/**
 * Serialize AIContext into a compact string for injection into prompts.
 */
export function serializeContext(ctx: AIContext): string {
  const lines: string[] = [
    `Hospital: ${ctx.hospital.name} (Plan: ${ctx.hospital.plan})`,
    `Logged-in user: ${ctx.user.name} (Role: ${ctx.user.role})`,
  ]

  if (ctx.patient) {
    lines.push("")
    lines.push(`Patient: ${ctx.patient.name} | ID: ${ctx.patient.patientId}`)
    if (ctx.patient.age) lines.push(`  Age: ${ctx.patient.age}, Gender: ${ctx.patient.gender || "N/A"}`)
    if (ctx.patient.medicalFlags.length > 0)
      lines.push(`  Medical flags: ${ctx.patient.medicalFlags.join(", ")}`)
    if (ctx.patient.currentMedications)
      lines.push(`  Current medications: ${ctx.patient.currentMedications}`)
    if (ctx.patient.outstandingBalance > 0)
      lines.push(`  Outstanding balance: ₹${ctx.patient.outstandingBalance.toLocaleString("en-IN")}`)
    if (ctx.patient.riskScore !== undefined) lines.push(`  Risk score: ${ctx.patient.riskScore}/100`)
    if (ctx.patient.treatmentPlans.length > 0)
      lines.push(
        `  Treatment plans: ${ctx.patient.treatmentPlans.map((tp) => `${tp.title} (${tp.status})`).join(", ")}`
      )
  }

  if (ctx.currentPage) lines.push(`\nCurrent page: ${ctx.currentPage}`)

  return lines.join("\n")
}
