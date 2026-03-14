import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { getModelForSkill } from "@/lib/ai/models"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getSkill } from "@/lib/ai/skills"

/**
 * GET /api/ai/pricing-suggestions — AI-powered pricing recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const { error, user, hospitalId } = await requireAuthAndRole(["ADMIN"])
    if (error) return error

    const skill = getSkill("dynamic-pricing")
    if (!skill) {
      return NextResponse.json({ error: "Dynamic pricing skill not found" }, { status: 500 })
    }

    // Gather scheduling and revenue data
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const [
      hospital,
      recentAppointments,
      doctors,
      procedures,
      recentInvoices,
    ] = await Promise.all([
      prisma.hospital.findUnique({
        where: { id: hospitalId! },
        select: { name: true, workingHours: true },
      }),
      prisma.appointment.findMany({
        where: {
          hospitalId: hospitalId!,
          scheduledDate: { gte: ninetyDaysAgo },
        },
        select: {
          scheduledDate: true,
          scheduledTime: true,
          duration: true,
          status: true,
          doctorId: true,
          doctor: { select: { firstName: true, lastName: true } },
        },
        orderBy: { scheduledDate: "desc" },
        take: 2000,
      }),
      prisma.user.findMany({
        where: { hospitalId: hospitalId!, role: "DOCTOR", isActive: true },
        select: { id: true, name: true },
      }),
      prisma.procedure.findMany({
        where: { hospitalId: hospitalId!, isActive: true },
        select: { id: true, name: true, basePrice: true, category: true },
        take: 50,
      }),
      prisma.invoice.findMany({
        where: {
          hospitalId: hospitalId!,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          totalAmount: true,
          createdAt: true,
          items: { select: { description: true, amount: true } },
        },
        take: 500,
      }),
    ])

    if (!hospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 })
    }

    // Analyze appointment patterns by day and hour
    const dayHourMap: Record<string, Record<string, number>> = {}
    const doctorApptCount: Record<string, number> = {}
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    recentAppointments.forEach((appt) => {
      const date = new Date(appt.scheduledDate)
      const day = dayNames[date.getDay()]
      const hour = appt.scheduledTime?.slice(0, 5) || "09:00"

      if (!dayHourMap[day]) dayHourMap[day] = {}
      dayHourMap[day][hour] = (dayHourMap[day][hour] || 0) + 1

      const docName = appt.doctor ? `${appt.doctor.firstName} ${appt.doctor.lastName}` : appt.doctorId
      doctorApptCount[docName] = (doctorApptCount[docName] || 0) + 1
    })

    // Build context string
    const contextStr = `
SCHEDULING DATA (Last 90 days):
- Total appointments: ${recentAppointments.length}
- Active doctors: ${doctors.length}
- Appointment distribution by day:
${Object.entries(dayHourMap).map(([day, hours]) => {
  const total = Object.values(hours).reduce((s, v) => s + v, 0)
  return `  ${day}: ${total} appointments`
}).join("\n")}

DOCTOR UTILIZATION:
${Object.entries(doctorApptCount).map(([name, count]) => `  ${name}: ${count} appointments (${Math.round(count / 90 * 100 / 8)}% daily utilization est.)`).join("\n")}

PROCEDURES:
${procedures.slice(0, 20).map((p) => `  ${p.name} (${p.category || "General"}) — ₹${p.basePrice}`).join("\n")}

REVENUE (Last 30 days):
- Total invoices: ${recentInvoices.length}
- Total revenue: ₹${recentInvoices.reduce((s, inv) => s + Number(inv.totalAmount), 0).toLocaleString()}
- Working hours: ${hospital.workingHours || "09:00-18:00, Mon-Sat"}
`

    const modelConfig = getModelForSkill("dynamic-pricing")
    const systemPrompt = skill.systemPrompt(hospital.name, contextStr)

    const response = await complete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze the scheduling and revenue data and provide pricing recommendations." },
      ],
      modelConfig
    )

    let suggestions
    try {
      suggestions = JSON.parse(extractJSON(response.content))
    } catch {
      suggestions = { raw: response.content, error: "Failed to parse structured response" }
    }

    // Log the skill execution
    await prisma.aISkillExecution.create({
      data: {
        hospitalId: hospitalId!,
        userId: user!.id,
        skill: "dynamic-pricing",
        input: { type: "pricing_analysis" },
        output: suggestions,
        tokensUsed: response.usage.totalTokens,
      },
    }).catch(() => {}) // Non-blocking

    return NextResponse.json({
      suggestions,
      generatedAt: new Date().toISOString(),
      model: response.model,
      tokensUsed: response.usage.totalTokens,
    })
  } catch (err) {
    console.error("Pricing suggestions error:", err)
    return NextResponse.json({ error: "Failed to generate pricing suggestions" }, { status: 500 })
  }
}
