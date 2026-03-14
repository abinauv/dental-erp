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

ALSO classify the COMPLEXITY of the user's latest message for cost-optimized model routing:
- "simple" = greetings, yes/no answers, short factual lookups, confirmations, thanks, basic show/search commands
- "complex" = treatment planning, clinical analysis, financial analysis, multi-step reasoning, report generation, detailed explanations

Respond ONLY with JSON:
{"action": "<name>", "params": {…}, "complexity": "simple"|"complex"}`

export async function POST(req: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole()
  if (error || !user || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { messages: ChatMessage[]; patientId?: string; page?: string; skillName?: string; stream?: boolean; voiceMode?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { messages, patientId, page, skillName, stream: shouldStream = true, voiceMode = false } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 })
  }

  try {
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
${voiceMode ? `
VOICE MODE — The user is speaking to you via voice and your response will be read aloud by text-to-speech:
- Respond in natural, conversational spoken language — as if talking to a colleague
- NEVER use markdown formatting (no asterisks, hashes, bullet points, numbered lists, backticks, or brackets)
- Instead of bullet lists, use short natural sentences connected with "and", "also", "next", etc.
- Keep responses brief and to the point — 2-3 sentences for simple queries, up to 5 for complex ones
- Use natural speech patterns: "So," "Alright," "Got it," "Here's what I found" etc.
- For numbers, say them naturally (e.g. "twenty-five thousand rupees" not "₹25,000")
- For dates, say "February fifteenth" not "2026-02-15"
- When an ACTION RESULT is present, you MUST clearly confirm what was done with the key details. For example say "Done! I've created patient John Doe with ID PAT-00001 and phone 9876543210. Want me to book an appointment for them?" — NEVER just say "I will create the patient" if the action already happened.
- End with a brief prompt like "Want me to do anything else?" or "Should I go ahead?" to keep the conversation flowing
` : ''}
Today's date: ${today}

CONTEXT:
${contextStr}`
  }

  // -----------------------------------------------------------------------
  // Intent detection (runs on Flash for cost savings — ~10x cheaper)
  // Also classifies complexity to decide if the response needs a bigger model
  // -----------------------------------------------------------------------
  let actionContext = ""
  let messageComplexity: "simple" | "complex" = "simple"
  try {
    const recentMessages = messages.slice(-8) // last 4 turns for context
    const { content: intentRaw } = await complete(
      [
        { role: "system", content: INTENT_PROMPT + `\n\nToday: ${today}\nClinic context:\n${contextStr}` },
        ...recentMessages,
      ],
      getModelByTier("fast") // ← Flash model for intent detection
    )
    const parsed = JSON.parse(extractJSON(intentRaw))

    // Capture complexity classification from the intent model
    if (parsed.complexity === "complex") messageComplexity = "complex"

    if (parsed.action && parsed.action !== "none") {
      // Only escalate to Pro for actions that need analysis/reasoning in the response.
      // Simple CRUD confirmations (create, update, book, cancel, record, add, show, search)
      // can be handled by Flash Lite — they just report back the result.
      const ANALYSIS_ACTIONS = new Set([
        "daily_summary", "show_revenue", "check_overdue", "low_stock",
      ])
      if (ANALYSIS_ACTIONS.has(parsed.action)) {
        messageComplexity = "complex"
      }
      // For all other actions, keep the complexity from intent detection (defaults to "simple")
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

  // Log interaction (non-blocking — don't let logging failures break the response)
  prisma.aIConversation.create({
    data: {
      hospitalId,
      userId: user.id,
      sessionType: skillName ? "COMMAND" : "CHAT",
      messages: messages as any,
      context: context as any,
    },
  }).catch((e: any) => console.error("AI conversation log failed:", e.message))

  prisma.auditLog.create({
    data: {
      hospitalId,
      userId: user.id,
      action: "AI_INTERACTION",
      entityType: "AIConversation",
      entityId: skillName || "chat",
    },
  }).catch((e: any) => console.error("AI audit log failed:", e.message))

  // -----------------------------------------------------------------------
  // Smart model routing — Flash Lite by default, escalate only when needed
  //   Skill-specific → use the skill's assigned tier (Flash/Pro/Opus)
  //   Complex general → use Pro (analysis, multi-step reasoning)
  //   Simple general  → use Flash Lite (chat tier) — ~10x cheaper
  //   Simple actions  → Flash Lite (CRUD confirmations don't need Pro)
  // -----------------------------------------------------------------------
  let tier: string
  if (skillName) {
    tier = (await import("@/lib/ai/models")).SKILL_MODEL_MAP[skillName] || "default"
  } else if (messageComplexity === "simple" && !actionContext) {
    tier = "chat" // Flash — greetings, FAQs, basic lookups
  } else {
    tier = "default" // Pro — complex reasoning, action follow-ups
  }
  const model = getModelByTier(tier)

  try {
    if (shouldStream) {
      return await streamResponse(allMessages, model)
    }
    // Non-streaming mode for mobile — return complete JSON response
    const { content } = await complete(allMessages, model)
    return NextResponse.json({ response: content })
  } catch (err) {
    console.error("AI response error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI service error" },
      { status: 502 }
    )
  }

  } catch (err: any) {
    console.error("AI chat route error:", err)
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    )
  }
}
