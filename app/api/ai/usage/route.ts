/**
 * GET /api/ai/usage
 *
 * Returns AI usage statistics for the authenticated hospital.
 * Admin-only.  Includes all-time totals, this-month totals, and a
 * top-10 skill breakdown for the current month.
 */

import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error) return error

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const hid = hospitalId!

  // ---------------------------------------------------------------
  // Parallel fetches
  // ---------------------------------------------------------------
  const [totalConvos, totalExecs, totalInsights, monthConvos, monthExecs, costAgg, monthCostAgg, recentExecs] =
    await Promise.all([
      prisma.aIConversation.count({ where: { hospitalId: hid } }),
      prisma.aISkillExecution.count({ where: { hospitalId: hid } }),
      prisma.aIInsight.count({ where: { hospitalId: hid } }),
      prisma.aIConversation.count({ where: { hospitalId: hid, createdAt: { gte: monthStart } } }),
      prisma.aISkillExecution.count({ where: { hospitalId: hid, createdAt: { gte: monthStart } } }),
      prisma.aISkillExecution.aggregate({
        _sum: { cost: true, tokensUsed: true },
        where: { hospitalId: hid },
      }),
      prisma.aISkillExecution.aggregate({
        _sum: { cost: true, tokensUsed: true },
        where: { hospitalId: hid, createdAt: { gte: monthStart } },
      }),
      // Fetch this-month executions for in-memory skill grouping
      prisma.aISkillExecution.findMany({
        where: { hospitalId: hid, createdAt: { gte: monthStart } },
        select: { skill: true, cost: true },
      }),
    ])

  // ---------------------------------------------------------------
  // Skill breakdown (grouped in JS to avoid groupBy quirks)
  // ---------------------------------------------------------------
  const skillMap = new Map<string, { executions: number; cost: number }>()
  for (const exec of recentExecs) {
    const prev = skillMap.get(exec.skill) || { executions: 0, cost: 0 }
    skillMap.set(exec.skill, {
      executions: prev.executions + 1,
      cost: prev.cost + Number(exec.cost || 0),
    })
  }
  const skillBreakdown = [...skillMap.entries()]
    .map(([skill, data]) => ({ skill, ...data }))
    .sort((a, b) => b.executions - a.executions)
    .slice(0, 10)

  return NextResponse.json({
    allTime: {
      conversations: totalConvos,
      executions: totalExecs,
      insights: totalInsights,
      tokens: costAgg._sum.tokensUsed ?? 0,
      costINR: Number(costAgg._sum.cost ?? 0),
    },
    thisMonth: {
      conversations: monthConvos,
      executions: monthExecs,
      tokens: monthCostAgg._sum.tokensUsed ?? 0,
      costINR: Number(monthCostAgg._sum.cost ?? 0),
    },
    skillBreakdown,
  })
}
