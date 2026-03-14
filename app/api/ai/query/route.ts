import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

/**
 * Whitelisted query specs — maps "model" names to safe Prisma query builders.
 * The AI outputs a spec; we only execute if the model is in this whitelist.
 */
const QUERY_BUILDERS: Record<
  string,
  (hospitalId: string, filters: Record<string, any>, limit: number) => Promise<any>
> = {
  invoice: async (hospitalId, filters, limit) => {
    const where: any = { hospitalId }
    if (filters.status) where.status = filters.status
    if (filters.minBalance) where.balanceAmount = { gte: Number(filters.minBalance) }
    return prisma.invoice.findMany({
      where,
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  },
  patient: async (hospitalId, filters, limit) => {
    const where: any = { hospitalId }
    if (filters.name) {
      where.OR = [
        { firstName: { contains: filters.name } },
        { lastName: { contains: filters.name } },
      ]
    }
    if (filters.minAge) where.age = { gte: Number(filters.minAge) }
    return prisma.patient.findMany({
      where,
      select: { firstName: true, lastName: true, patientId: true, age: true, phone: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  },
  appointment: async (hospitalId, filters, limit) => {
    const where: any = { hospitalId }
    if (filters.status) where.status = filters.status
    if (filters.date) {
      const d = new Date(filters.date + "T00:00:00")
      if (!isNaN(d.getTime())) where.scheduledDate = d
    }
    return prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledDate: "desc" },
      take: limit,
    })
  },
  treatment: async (hospitalId, filters, limit) => {
    const where: any = { hospitalId }
    if (filters.status) where.status = filters.status
    return prisma.treatment.findMany({
      where,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        procedure: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  },
  inventoryItem: async (hospitalId, filters, limit) => {
    const where: any = { hospitalId }
    if (filters.lowStock) where.currentStock = { lte: filters.reorderLevel || 20 }
    return prisma.inventoryItem.findMany({
      where,
      select: { name: true, currentStock: true, reorderLevel: true, minimumStock: true, unit: true },
      take: limit,
    })
  },
}

const AVAILABLE_MODELS = Object.keys(QUERY_BUILDERS).join(", ")

function queryTranslatorPrompt(naturalQuery: string) {
  return `You translate natural-language questions into structured query specs for a dental clinic database.

Available models: ${AVAILABLE_MODELS}

Model fields reference:
- invoice:        status (DRAFT|PENDING|PARTIALLY_PAID|PAID|OVERDUE|CANCELLED), balanceAmount
- patient:        name, age
- appointment:    status (SCHEDULED|CONFIRMED|COMPLETED|CANCELLED|NO_SHOW), date
- treatment:      status (PLANNED|IN_PROGRESS|COMPLETED|CANCELLED)
- inventoryItem:  lowStock (boolean flag – set true to get items at or below reorder level)

Respond ONLY with JSON:
{
  "model": "<one of: ${AVAILABLE_MODELS}>",
  "filters": { ... },
  "limit": <number, max 50>,
  "summary": "<plain English restatement of the query>"
}

User query: "${naturalQuery}"`
}

export async function POST(req: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole()
  if (error || !user || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { query: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { query } = body
  if (!query?.trim()) return NextResponse.json({ error: "query is required" }, { status: 400 })

  // Step 1: translate to spec
  let spec: { model: string; filters: Record<string, any>; limit?: number; summary?: string }
  try {
    const { content } = await complete(
      [{ role: "system", content: queryTranslatorPrompt(query) }],
      getModelByTier("query")
    )
    spec = JSON.parse(extractJSON(content))
  } catch (err) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("OpenRouter")) {
      return NextResponse.json({ error: `AI service error: ${msg}` }, { status: 502 })
    }
    return NextResponse.json({ error: "Could not parse your query. Try rephrasing." }, { status: 400 })
  }

  // Step 2: validate model is whitelisted
  const builder = QUERY_BUILDERS[spec.model]
  if (!builder) {
    return NextResponse.json({ error: `Unsupported data source: ${spec.model}` }, { status: 400 })
  }

  // Step 3: execute
  const limit = Math.min(spec.limit || 10, 50)
  let rows: any[]
  try {
    rows = await builder(hospitalId, spec.filters || {}, limit)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Query execution error" }, { status: 500 })
  }

  // Log
  await prisma.aISkillExecution.create({
    data: {
      hospitalId,
      userId: user.id,
      skill: "nl_query",
      input: { query, spec } as any,
      output: { rowCount: rows.length } as any,
      status: "COMPLETED",
    },
  })

  return NextResponse.json({
    summary: spec.summary || query,
    model: spec.model,
    rowCount: rows.length,
    rows,
  })
}
