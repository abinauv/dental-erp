import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { buildContext, serializeContext } from "@/lib/ai/context-builder"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

function suggestionsPrompt(contextStr: string, page: string) {
  return `You are the context-aware suggestion engine for DentalERP.

Based on the current page and context, suggest 2–3 short, actionable items the user might want to do RIGHT NOW.

PAGE: ${page}
CONTEXT:
${contextStr}

Respond ONLY with a JSON array. Each item:
{
  "title": "short title (≤ 60 chars)",
  "description": "one-line detail (≤ 100 chars)",
  "action": "<action_code>",
  "urgency": "normal" | "warning" | "critical"
}

Valid action codes: book_appointment, check_patient, show_revenue, check_overdue,
send_reminder, check_stock, generate_invoice, view_patients, general

SUGGESTION GUIDELINES by page:
- /patients or /patients/[id]:  risk scores, duplicate checks, recall status
- /appointments:                unconfirmed appointments, upcoming no-show risks
- /billing or /billing/*:       overdue invoices, unbilled treatments
- /inventory:                   low-stock alerts, expiring batches
- /dashboard:                   daily overview items, overdue actions
- /treatments:                  pending follow-ups
- /lab:                         delayed lab orders
- /reports:                     trend anomalies

Keep it concise and relevant.`
}

export async function GET(req: NextRequest) {
  const { error, user, hospitalId } = await requireAuthAndRole()
  if (error || !user || !hospitalId) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const searchParams = req.nextUrl.searchParams
  const page = searchParams.get("page") || "/dashboard"
  const patientId = searchParams.get("patientId")

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

  // Enrich context with page-specific data
  let enrichment = ""
  if (page.startsWith("/billing")) {
    const overdue = await prisma.invoice.count({ where: { hospitalId, status: "OVERDUE" } })
    if (overdue > 0) enrichment += `\nOverdue invoices: ${overdue}`
  }
  if (page.startsWith("/appointments")) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const unconfirmed = await prisma.appointment.count({
      where: { hospitalId, scheduledDate: tomorrow, status: "SCHEDULED" },
    })
    if (unconfirmed > 0) enrichment += `\nUnconfirmed appointments tomorrow: ${unconfirmed}`
  }
  if (page.startsWith("/inventory")) {
    const allItems = await prisma.inventoryItem.findMany({
      where: { hospitalId, isActive: true },
      select: { name: true, currentStock: true, reorderLevel: true },
    })
    const low = allItems.filter((i) => i.currentStock <= i.reorderLevel)
    if (low.length > 0) enrichment += `\nLow-stock items: ${low.map((i) => i.name).join(", ")}`
  }

  let suggestions: Array<{ title: string; description: string; action: string; urgency: string }> = []
  try {
    const { content } = await complete(
      [
        { role: "system", content: suggestionsPrompt(contextStr + enrichment, page) },
        { role: "user", content: "Generate suggestions for the current page." },
      ],
      getModelByTier("default")
    )
    suggestions = JSON.parse(extractJSON(content))
    if (!Array.isArray(suggestions)) suggestions = []
  } catch {
    suggestions = []
  }

  return NextResponse.json({ suggestions })
}
