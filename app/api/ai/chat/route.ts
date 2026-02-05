import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { buildContext, serializeContext } from "@/lib/ai/context-builder"
import { streamResponse } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"
import type { ChatMessage } from "@/lib/ai/openrouter"

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
- You MUST NOT provide clinical diagnoses — only suggestions for doctor review
- You MUST NOT prescribe medications — only flag interactions for doctor approval
- You MUST NOT share patient data across hospitals
- Financial transactions over ₹5,000 require human approval
- Mark all AI-generated clinical suggestions as "pending doctor review"
- Be concise and professional

CONTEXT:
${contextStr}`
  }

  const allMessages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...messages.slice(-20), // keep last 20 for context window
  ]

  // Log interaction
  await prisma.aiConversation.create({
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
