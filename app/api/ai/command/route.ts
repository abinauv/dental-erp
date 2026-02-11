import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { buildContext, serializeContext } from "@/lib/ai/context-builder"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"
import { executeIntent } from "@/lib/ai/command-executors"

// ---------------------------------------------------------------------------
// Intent definitions — the AI outputs one of these intents
// ---------------------------------------------------------------------------
const INTENTS = `
PATIENT MANAGEMENT:
1.  create_patient        – params: { firstName, lastName, phone, age?, gender?, email?, dateOfBirth?, address?, city?, bloodGroup? }
2.  update_patient        – params: { query, phone?, email?, address?, city?, age?, firstName?, lastName?, gender?, bloodGroup? }
3.  search_patients       – params: { query?, gender?, minAge? }
4.  check_patient         – params: { query } (name, ID, or phone — full details)

APPOINTMENTS:
5.  book_appointment      – params: { patientName, doctorName?, date?, time?, type?, duration?, complaint? }
6.  cancel_appointment    – params: { appointmentNo?, patientName?, reason? }
7.  reschedule_appointment – params: { appointmentNo?, patientName?, newDate?, newTime? }
8.  complete_appointment  – params: { appointmentNo?, patientName? }
9.  show_appointments     – params: { date?, doctorName?, status? }

TREATMENTS:
10. create_treatment      – params: { patientName, procedureName, doctorName?, cost?, complaint?, diagnosis?, toothNumbers? }
11. complete_treatment    – params: { treatmentNo?, patientName?, notes?, followUpDate? }
12. show_treatments       – params: { patientName?, status? }

BILLING & PAYMENTS:
13. create_invoice        – params: { patientName } (creates from unbilled completed treatments)
14. record_payment        – params: { invoiceNo?, patientName?, amount?, method? }
15. show_invoices         – params: { patientName?, status? }
16. check_overdue         – params: {}
17. show_revenue          – params: { period: "today"|"this_week"|"this_month"|"last_month"|"this_quarter" }

INVENTORY:
18. check_stock           – params: { itemName }
19. low_stock             – params: {}
20. add_inventory_item    – params: { name, unit?, price?, quantity?, minStock?, reorderLevel?, sku? }
21. update_stock          – params: { itemName, quantity, type: "add"|"remove", reason? }

LAB ORDERS:
22. create_lab_order      – params: { patientName, workType?, labName?, cost?, description?, toothNumbers?, shade? }
23. update_lab_order      – params: { orderNumber, status?, notes? }
24. show_lab_orders       – params: { patientName?, status? }

PRESCRIPTIONS:
25. create_prescription   – params: { patientName, doctorName?, diagnosis?, medications?, notes? }

MEDICATIONS (Drug Catalog):
29. add_medication        – params: { name, genericName?, category?, form?, strength?, manufacturer?, defaultDosage?, defaultFrequency?, defaultDuration? }
30. search_medications    – params: { query?, category? }
31. show_prescriptions    – params: { patientName?, doctorName? }

STAFF:
26. show_staff            – params: {}

ANALYTICS:
27. daily_summary         – params: {}

28. general               – params: {} (fall-back for any query that doesn't match the above)
`.trim()

function commandParserPrompt(contextStr: string, today: string) {
  return `You are a command parser for DentalERP. Parse the user's natural-language command into a structured action.

Available intents:
${INTENTS}

Today's date is ${today}. Convert relative dates (e.g. "tomorrow", "next Tuesday") to ISO format (YYYY-MM-DD).

Rules:
- If the intent involves a financial action (create_invoice, record_payment), set requiresApproval: true
- confidence: 0.0–1.0
- If nothing matches, use "general"
- Gender values: MALE, FEMALE, OTHER
- Payment methods: CASH, CARD, UPI, BANK_TRANSFER, CHEQUE
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

// General intent handler (uses AI completion — kept here to avoid circular deps)
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
  if (error || !user || !hospitalId) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
    if (parsed.intent === "general") {
      result = await execGeneral(command, contextStr, hospital?.name || "Hospital")
    } else {
      result = await executeIntent(parsed.intent, parsed.params, hospitalId)
      if (!result) result = await execGeneral(command, contextStr, hospital?.name || "Hospital")
    }
  } catch (err) {
    result = { success: false, message: err instanceof Error ? err.message : "Execution error" }
  }

  const duration = Date.now() - startTime

  // Log
  await prisma.aISkillExecution.create({
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
