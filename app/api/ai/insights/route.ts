import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { complete } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"
import { extractJSON } from "@/lib/ai/openrouter"

/**
 * GET /api/ai/insights – fetch recent, non-dismissed insights
 * POST /api/ai/insights – trigger AI insight generation
 * PUT  /api/ai/insights – dismiss or mark action-taken on an insight
 */

// GET – list insights
export async function GET(req: NextRequest) {
  const { error, user, hospitalId } = await requireAuthAndRole()
  if (error || !user || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const category = req.nextUrl.searchParams.get("category")
  const where: any = { hospitalId, dismissed: false }
  if (category) where.category = category
  // Exclude expired insights
  where.OR = [{ expiresAt: null }, { expiresAt: { gte: new Date() } }]

  const insights = await prisma.aIInsight.findMany({
    where,
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 20,
  })

  return NextResponse.json({ insights })
}

// POST – generate fresh insights via AI
export async function POST(req: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !user || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Gather clinic data for the analysis window (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [invoices, appointments, inventoryItems, labOrders] = await Promise.all([
    prisma.invoice.findMany({
      where: { hospitalId, createdAt: { gte: thirtyDaysAgo } },
      select: { totalAmount: true, paidAmount: true, status: true, createdAt: true },
    }),
    prisma.appointment.findMany({
      where: { hospitalId, createdAt: { gte: thirtyDaysAgo } },
      select: { status: true, scheduledDate: true, appointmentType: true },
    }),
    prisma.inventoryItem.findMany({
      where: { hospitalId, isActive: true },
      select: { name: true, currentStock: true, reorderLevel: true, minimumStock: true },
    }),
    prisma.labOrder.findMany({
      where: { hospitalId, createdAt: { gte: thirtyDaysAgo } },
      select: { status: true, expectedDate: true, orderDate: true },
    }),
  ])

  const dataSnapshot = {
    invoiceSummary: {
      total: invoices.length,
      totalBilled: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalCollected: invoices.reduce((s, i) => s + Number(i.paidAmount), 0),
      overdueCount: invoices.filter((i) => i.status === "OVERDUE").length,
    },
    appointmentSummary: {
      total: appointments.length,
      noShows: appointments.filter((a) => a.status === "NO_SHOW").length,
      cancelled: appointments.filter((a) => a.status === "CANCELLED").length,
      completed: appointments.filter((a) => a.status === "COMPLETED").length,
    },
    lowStockItems: inventoryItems
      .filter((i) => i.currentStock <= i.reorderLevel)
      .map((i) => ({ name: i.name, stock: i.currentStock })),
    delayedLabOrders: labOrders.filter(
      (lo) => lo.expectedDate && new Date(lo.expectedDate) < new Date() && lo.status !== "DELIVERED" && lo.status !== "FITTED"
    ).length,
  }

  const prompt = `You are an insight engine for a dental clinic. Analyse the following 30-day data snapshot and generate 3–5 actionable insights.

DATA:
${JSON.stringify(dataSnapshot, null, 2)}

Each insight must have:
- category: REVENUE | CLINICAL | OPERATIONAL | PATIENT | STAFFING | INVENTORY
- severity: INFO | WARNING | CRITICAL
- title: short (≤ 80 chars)
- description: 1–2 sentences with the specific numbers
- actionable: true/false

Respond ONLY with a JSON array of insight objects:
[{ "category": "...", "severity": "...", "title": "...", "description": "...", "actionable": true }]`

  let insights: Array<{ category: string; severity: string; title: string; description: string }> = []
  try {
    const { content } = await complete(
      [{ role: "system", content: prompt }],
      getModelByTier("fast") // Structured JSON output from numeric data — Flash handles this well
    )
    insights = JSON.parse(extractJSON(content))
    if (!Array.isArray(insights)) insights = []
  } catch {
    return NextResponse.json({ error: "Insight generation failed" }, { status: 502 })
  }

  // Persist
  const created = await Promise.all(
    insights.map((ins) =>
      prisma.aIInsight.create({
        data: {
          hospitalId,
          category: (ins.category as any) || "OPERATIONAL",
          severity: (ins.severity as any) || "INFO",
          title: ins.title,
          description: ins.description,
          data: dataSnapshot as any,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      })
    )
  )

  return NextResponse.json({ insights: created, count: created.length })
}

// PUT – dismiss or mark action-taken
export async function PUT(req: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !user || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { id: string; dismissed?: boolean; actionTaken?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { id, dismissed, actionTaken } = body
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const updated = await prisma.aIInsight.updateMany({
    where: { id, hospitalId },
    data: {
      ...(dismissed !== undefined && { dismissed }),
      ...(actionTaken !== undefined && { actionTaken }),
    },
  })

  if (updated.count === 0) return NextResponse.json({ error: "Insight not found" }, { status: 404 })

  return NextResponse.json({ updated: true })
}
