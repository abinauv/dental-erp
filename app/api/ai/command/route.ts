import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { buildContext, serializeContext } from "@/lib/ai/context-builder"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

// ---------------------------------------------------------------------------
// Intent definitions — the AI outputs one of these intents
// ---------------------------------------------------------------------------
const INTENTS = `
1. book_appointment  – params: { patientName, doctorName?, date?, time?, type? }
2. check_patient     – params: { query } (name, ID, or phone)
3. check_stock       – params: { itemName }
4. show_revenue      – params: { period: "today"|"this_week"|"this_month"|"last_month"|"this_quarter" }
5. show_appointments – params: { date?, doctorName? }
6. generate_invoice  – params: { query } (patient name or ID)
7. check_overdue     – params: {}
8. low_stock         – params: {}
9. general           – params: {} (fall-back for any query that doesn't match the above)
`.trim()

function commandParserPrompt(contextStr: string, today: string) {
  return `You are a command parser for DentalERP. Parse the user's natural-language command into a structured action.

Available intents:
${INTENTS}

Today's date is ${today}. Convert relative dates (e.g. "tomorrow", "next Tuesday") to ISO format (YYYY-MM-DD).

Rules:
- If the intent involves a financial action (generate_invoice), set requiresApproval: true
- confidence: 0.0–1.0
- If nothing matches, use "general"
- Respond ONLY with valid JSON — no markdown, no explanation

CONTEXT:
${contextStr}

Output format:
{
  "intent": "<intent_name>",
  "params": { ... },
  "confidence": <number>,
  "summary": "<one-line description>",
  "requiresApproval": <boolean>
}`
}

// ---------------------------------------------------------------------------
// Intent executors
// ---------------------------------------------------------------------------
async function execBookAppointment(params: Record<string, string>, hospitalId: string) {
  const patient = await prisma.patient.findFirst({
    where: {
      hospitalId,
      OR: [
        { firstName: { contains: params.patientName, mode: "insensitive" } },
        { lastName: { contains: params.patientName, mode: "insensitive" } },
        { patientId: params.patientName },
      ],
    },
  })
  if (!patient) return { success: false, message: `Patient "${params.patientName}" not found.` }

  let doctor = null
  if (params.doctorName) {
    doctor = await prisma.staff.findFirst({
      where: {
        hospitalId,
        OR: [
          { firstName: { contains: params.doctorName, mode: "insensitive" } },
          { lastName: { contains: params.doctorName, mode: "insensitive" } },
        ],
      },
    })
    if (!doctor) return { success: false, message: `Doctor "${params.doctorName}" not found.` }
  } else {
    doctor = await prisma.staff.findFirst({ where: { hospitalId, isActive: true } })
  }
  if (!doctor) return { success: false, message: "No doctors available." }

  const date = params.date || new Date().toISOString().split("T")[0]
  const time = params.time || "10:00"

  const conflict = await prisma.appointment.findFirst({
    where: {
      hospitalId,
      doctorId: doctor.id,
      scheduledDate: new Date(date + "T00:00:00"),
      scheduledTime: time,
      status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN"] },
    },
  })
  if (conflict) {
    return { success: false, message: `Dr. ${doctor.firstName} already has a booking at ${time} on ${date}. Pick another time.` }
  }

  const count = await prisma.appointment.count({ where: { hospitalId } })
  const appointmentNo = `APT-${String(count + 1).padStart(5, "0")}`

  await prisma.appointment.create({
    data: {
      hospitalId,
      appointmentNo,
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledDate: new Date(date + "T00:00:00"),
      scheduledTime: time,
      duration: 30,
      appointmentType: (params.type as any) || "CONSULTATION",
      status: "SCHEDULED",
      priority: params.type === "EMERGENCY" ? "URGENT" : "NORMAL",
    },
  })

  return {
    success: true,
    message: `Appointment booked for ${patient.firstName} ${patient.lastName} with Dr. ${doctor.firstName} on ${date} at ${time}.`,
  }
}

async function execCheckPatient(params: Record<string, string>, hospitalId: string) {
  const q = params.query
  const patient = await prisma.patient.findFirst({
    where: {
      hospitalId,
      OR: [
        { patientId: q },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    include: {
      medicalHistory: true,
      treatmentPlans: { orderBy: { createdAt: "desc" }, take: 3 },
      appointments: { orderBy: { scheduledDate: "desc" }, take: 3 },
      invoices: { where: { status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } } },
    },
  })
  if (!patient) return { success: false, message: `Patient "${q}" not found.` }

  const flags: string[] = []
  if (patient.medicalHistory) {
    const h = patient.medicalHistory
    if (h.drugAllergies) flags.push(`Allergies: ${h.drugAllergies}`)
    if (h.hasDiabetes) flags.push("Diabetes")
    if (h.hasHypertension) flags.push("Hypertension")
    if (h.isPregnant) flags.push("Pregnant")
    if (h.hasBleedingDisorder) flags.push("Bleeding Disorder")
  }

  return {
    success: true,
    summary: {
      name: `${patient.firstName} ${patient.lastName}`,
      id: patient.patientId,
      age: patient.age,
      phone: patient.phone,
      medicalFlags: flags,
      outstandingBalance: `₹${patient.invoices.reduce((s, i) => s + Number(i.balanceAmount), 0).toLocaleString("en-IN")}`,
      recentAppointments: patient.appointments.map((a) => `${a.scheduledDate.toISOString().split("T")[0]} – ${a.appointmentType} (${a.status})`),
      treatmentPlans: patient.treatmentPlans.map((tp) => `${tp.title} – ${tp.status}`),
    },
  }
}

async function execCheckStock(params: Record<string, string>, hospitalId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { hospitalId, name: { contains: params.itemName, mode: "insensitive" } },
    select: { name: true, currentStock: true, minimumStock: true, reorderLevel: true, unit: true },
  })
  if (items.length === 0) return { success: false, message: `No items matching "${params.itemName}".` }

  return {
    success: true,
    items: items.map((i) => ({
      name: i.name,
      stock: `${i.currentStock} ${i.unit}`,
      status: i.currentStock <= i.minimumStock ? "Critical" : i.currentStock <= i.reorderLevel ? "Low" : "OK",
    })),
  }
}

async function execShowRevenue(params: Record<string, string>, hospitalId: string) {
  const now = new Date()
  const period = params.period || "this_month"
  let startDate: Date
  switch (period) {
    case "today":        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
    case "this_week":    startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay()); break
    case "last_month":   startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); break
    case "this_quarter": startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break
    default:             startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const invoices = await prisma.invoice.findMany({
    where: { hospitalId, createdAt: { gte: startDate }, status: { not: "CANCELLED" } },
    select: { totalAmount: true, paidAmount: true },
  })
  const billed = invoices.reduce((s, i) => s + Number(i.totalAmount), 0)
  const collected = invoices.reduce((s, i) => s + Number(i.paidAmount), 0)

  return {
    success: true,
    period,
    totalBilled: `₹${billed.toLocaleString("en-IN")}`,
    totalCollected: `₹${collected.toLocaleString("en-IN")}`,
    collectionRate: billed > 0 ? `${((collected / billed) * 100).toFixed(1)}%` : "N/A",
    invoiceCount: invoices.length,
  }
}

async function execShowAppointments(params: Record<string, string>, hospitalId: string) {
  const date = params.date || new Date().toISOString().split("T")[0]
  const appts = await prisma.appointment.findMany({
    where: { hospitalId, scheduledDate: new Date(date + "T00:00:00") },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { firstName: true, lastName: true } },
    },
    orderBy: { scheduledTime: "asc" },
  })
  return {
    success: true,
    date,
    count: appts.length,
    appointments: appts.map((a) => ({
      time: a.scheduledTime,
      patient: `${a.patient.firstName} ${a.patient.lastName}`,
      doctor: `Dr. ${a.doctor.firstName} ${a.doctor.lastName}`,
      type: a.appointmentType,
      status: a.status,
    })),
  }
}

async function execGenerateInvoice(params: Record<string, string>, hospitalId: string) {
  const q = params.query
  const patient = await prisma.patient.findFirst({
    where: {
      hospitalId,
      OR: [{ patientId: q }, { firstName: { contains: q, mode: "insensitive" } }],
    },
  })
  if (!patient) return { success: false, message: `Patient "${q}" not found.` }

  const unbilled = await prisma.treatment.findMany({
    where: { hospitalId, patientId: patient.id, status: "COMPLETED", invoiceItems: { none: {} } },
    include: { procedure: { select: { name: true } } },
  })
  if (unbilled.length === 0) return { success: false, message: `No unbilled treatments for ${patient.firstName} ${patient.lastName}.` }

  return {
    success: true,
    requiresApproval: true,
    message: `Found ${unbilled.length} unbilled treatment(s). Please review in the Billing module before generating the invoice.`,
    unbilledTreatments: unbilled.map((t) => ({ procedure: t.procedure.name, cost: Number(t.cost) })),
  }
}

async function execCheckOverdue(hospitalId: string) {
  const overdue = await prisma.invoice.findMany({
    where: { hospitalId, status: "OVERDUE" },
    include: { patient: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
    take: 10,
  })
  return {
    success: true,
    count: overdue.length,
    totalOverdue: `₹${overdue.reduce((s, i) => s + Number(i.balanceAmount), 0).toLocaleString("en-IN")}`,
    invoices: overdue.map((i) => ({
      invoiceNo: i.invoiceNo,
      patient: `${i.patient.firstName} ${i.patient.lastName}`,
      balance: `₹${Number(i.balanceAmount).toLocaleString("en-IN")}`,
    })),
  }
}

async function execLowStock(hospitalId: string) {
  const all = await prisma.inventoryItem.findMany({
    where: { hospitalId, isActive: true },
    select: { name: true, currentStock: true, reorderLevel: true, minimumStock: true, unit: true },
  })
  const low = all.filter((i) => i.currentStock <= i.reorderLevel)
  return {
    success: true,
    count: low.length,
    items: low.map((i) => ({
      name: i.name,
      stock: `${i.currentStock} ${i.unit}`,
      status: i.currentStock <= i.minimumStock ? "Critical" : "Low",
      reorderLevel: i.reorderLevel,
    })),
  }
}

async function execGeneral(command: string, contextStr: string, hospitalName: string) {
  const { content } = await complete(
    [
      {
        role: "system",
        content: `You are the AI assistant for ${hospitalName}. Answer the user's question helpfully and concisely.\n\nCONTEXT:\n${contextStr}`,
      },
      { role: "user", content: command },
    ],
    getModelByTier("default")
  )
  return { success: true, message: content, type: "general" }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole()
  if (error || !user || !hospitalId) return error

  let body: { command: string; patientId?: string; page?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { command, patientId, page } = body
  if (!command?.trim()) {
    return NextResponse.json({ error: "command is required" }, { status: 400 })
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { name: true, plan: true },
  })

  const context = await buildContext({
    hospitalId,
    userId: user.id,
    userName: user.name || "User",
    userRole: user.role,
    hospitalName: hospital?.name || "Hospital",
    hospitalPlan: hospital?.plan || "FREE",
    patientId,
    currentPage: page,
  })
  const contextStr = serializeContext(context)
  const today = new Date().toISOString().split("T")[0]

  // Step 1 — parse intent
  const startTime = Date.now()
  let parsed: { intent: string; params: Record<string, string>; summary?: string; requiresApproval?: boolean }
  try {
    const { content } = await complete(
      [
        { role: "system", content: commandParserPrompt(contextStr, today) },
        { role: "user", content: command },
      ],
      getModelByTier("command")
    )
    parsed = JSON.parse(extractJSON(content))
  } catch {
    // If parsing fails, fall back to general
    parsed = { intent: "general", params: {} }
  }

  // Step 2 — execute
  let result: any
  try {
    switch (parsed.intent) {
      case "book_appointment":  result = await execBookAppointment(parsed.params, hospitalId); break
      case "check_patient":     result = await execCheckPatient(parsed.params, hospitalId); break
      case "check_stock":       result = await execCheckStock(parsed.params, hospitalId); break
      case "show_revenue":      result = await execShowRevenue(parsed.params, hospitalId); break
      case "show_appointments": result = await execShowAppointments(parsed.params, hospitalId); break
      case "generate_invoice":  result = await execGenerateInvoice(parsed.params, hospitalId); break
      case "check_overdue":     result = await execCheckOverdue(hospitalId); break
      case "low_stock":         result = await execLowStock(hospitalId); break
      default:                  result = await execGeneral(command, contextStr, hospital?.name || "Hospital")
    }
  } catch (err) {
    result = { success: false, message: err instanceof Error ? err.message : "Execution error" }
  }

  const duration = Date.now() - startTime

  // Log
  await prisma.aiSkillExecution.create({
    data: {
      hospitalId,
      userId: user.id,
      skill: parsed.intent,
      input: { command, patientId, page } as any,
      output: result as any,
      status: result?.success ? "COMPLETED" : "FAILED",
      duration,
    },
  })

  return NextResponse.json({
    intent: parsed.intent,
    summary: parsed.summary,
    requiresApproval: parsed.requiresApproval || false,
    result,
  })
}
