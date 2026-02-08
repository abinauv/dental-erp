import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { buildContext, serializeContext } from "@/lib/ai/context-builder"
import { complete, extractJSON, streamResponse } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"
import { executeIntent } from "@/lib/ai/command-executors"
import type { ChatMessage } from "@/lib/ai/openrouter"

// ---------------------------------------------------------------------------
// Intent detection prompt — analyses full conversation to detect actions
// ---------------------------------------------------------------------------
const INTENT_PROMPT = `You detect user intent from dental clinic conversations.
Based on the conversation, determine if the user's LATEST message requires a real database action.

Available actions:

PATIENT MANAGEMENT:
1.  create_patient        – params: { firstName, lastName, phone, age?, gender?, email?, dateOfBirth?, address?, city?, bloodGroup? }
2.  update_patient        – params: { query, phone?, email?, address?, city?, age?, firstName?, lastName?, gender?, bloodGroup? }
3.  search_patients       – params: { query?, gender?, minAge? }
4.  check_patient         – params: { query } (name, ID, or phone — returns full details)

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
13. create_invoice        – params: { patientName } (creates invoice from unbilled completed treatments)
14. record_payment        – params: { invoiceNo?, patientName?, amount?, method? } (method: CASH, CARD, UPI, BANK_TRANSFER, CHEQUE)
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
    (workType: CROWN, BRIDGE, DENTURE, PARTIAL_DENTURE, IMPLANT_CROWN, VENEER, INLAY_ONLAY, NIGHT_GUARD, RETAINER, ALIGNER, MODEL, OTHER)
23. update_lab_order      – params: { orderNumber, status?, notes? }
24. show_lab_orders       – params: { patientName?, status? }

PRESCRIPTIONS:
25. create_prescription   – params: { patientName, doctorName?, diagnosis?, medications?, notes? }
    (medications: comma-separated "name dosage frequency duration")

STAFF:
26. show_staff            – params: {}

ANALYTICS:
27. daily_summary         – params: {}

28. none                  – no action needed (greeting, follow-up question, general chat)

Rules:
- Only output an action when the user clearly wants something done
- Greetings, general questions, or clarification requests → "none"
- Collect ALL required params from the conversation history, not just the last message
- Convert relative dates (today, tomorrow, next Monday) to YYYY-MM-DD
- If the user provides a name as a single word (e.g. "Raghu"), use it as firstName and ask for lastName if needed
- For create_patient, you MUST have at least firstName, lastName, and phone — ask the user if missing
- Gender values: MALE, FEMALE, OTHER
- Blood group values: A_POSITIVE, A_NEGATIVE, B_POSITIVE, B_NEGATIVE, AB_POSITIVE, AB_NEGATIVE, O_POSITIVE, O_NEGATIVE

Respond ONLY with JSON:
{"action": "<name>", "params": {…}}`

export async function POST(req: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole()
  if (error || !user || !hospitalId) return error

  let body: { messages: ChatMessage[]; patientId?: string; page?: string; skillName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { messages, patientId, page, skillName } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 })
  }

  // Rate-limit: max 100 requests/min checked via last-minute audit logs
  const oneMinuteAgo = new Date(Date.now() - 60_000)
  const recentCount = await prisma.auditLog.count({
    where: {
      hospitalId,
      userId: user.id,
      action: "AI_INTERACTION",
      createdAt: { gte: oneMinuteAgo },
    },
  })
  if (recentCount >= 100) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 })
  }

  // Build context
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

  // If a specific skill is requested, load its system prompt
  let systemContent: string
  if (skillName) {
    const { getSkill } = await import("@/lib/ai/skills/index")
    const skill = getSkill(skillName)
    if (!skill) {
      return NextResponse.json({ error: `Unknown skill: ${skillName}` }, { status: 400 })
    }
    if (!skill.allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "You do not have permission to use this skill" }, { status: 403 })
    }
    systemContent = skill.systemPrompt(context.hospital.name, contextStr)
  } else {
    systemContent = `You are the AI assistant for ${context.hospital.name}, a dental hospital management system. You help staff with clinic operations, patient queries, and data analysis.

IMPORTANT RULES:
- You MUST NOT share patient data across hospitals
- Be concise and professional
- NEVER claim you performed an action unless you see an ACTION RESULT below confirming it
- You CAN create patients, book appointments, create treatments, invoices, payments, lab orders, prescriptions, and manage inventory through actions
- When creating a patient, you MUST collect at minimum: firstName, lastName, and phone number before triggering the action
- If the user provides incomplete information for any action, ask for the missing required fields before proceeding
- Present action results clearly and offer follow-up actions (e.g. after creating a patient, offer to book an appointment)

Today's date: ${today}

CONTEXT:
${contextStr}`
  }

  // -----------------------------------------------------------------------
  // Intent detection — check if the user's message requires a real action
  // -----------------------------------------------------------------------
  let actionContext = ""
  try {
    const recentMessages = messages.slice(-8) // last 4 turns for context
    const { content: intentRaw } = await complete(
      [
        { role: "system", content: INTENT_PROMPT + `\n\nToday: ${today}\nClinic context:\n${contextStr}` },
        ...recentMessages,
      ],
      getModelByTier("command")
    )
    const parsed = JSON.parse(extractJSON(intentRaw))

    if (parsed.action && parsed.action !== "none") {
      const result = await executeIntent(parsed.action, parsed.params || {}, hospitalId)
      if (result) {
        actionContext = `\n\n--- ACTION RESULT ---
Action: ${parsed.action}
${JSON.stringify(result, null, 2)}
---
IMPORTANT: The above action was ACTUALLY executed in the database. Report the real result to the user. Do NOT invent different details.`
      }
    }
  } catch {
    // Intent detection failed — continue with normal chat
  }

  const allMessages: ChatMessage[] = [
    { role: "system", content: systemContent + actionContext },
    ...messages.slice(-20),
  ]

  // Log interaction
  await prisma.aIConversation.create({
    data: {
      hospitalId,
      userId: user.id,
      sessionType: skillName ? "COMMAND" : "CHAT",
      messages: messages as any,
      context: context as any,
    },
  })

  await prisma.auditLog.create({
    data: {
      hospitalId,
      userId: user.id,
      action: "AI_INTERACTION",
      entityType: "AIConversation",
      entityId: skillName || "chat",
    },
  })

  // Determine model tier
  const tier = skillName
    ? (await import("@/lib/ai/models")).SKILL_MODEL_MAP[skillName] || "default"
    : "default"
  const model = getModelByTier(tier)

  try {
    return await streamResponse(allMessages, model)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI service error" },
      { status: 502 }
    )
  }
}
