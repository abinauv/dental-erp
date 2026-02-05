/**
 * POST /api/cron/cleanup
 *
 * Data-retention cron job (Phase 6.2).
 * Deletes AI conversations and skill executions older than 90 days.
 * Removes expired AIInsight records.
 *
 * Secured via CRON_SECRET env var (Bearer token).
 * Schedule: daily at 2:00 AM IST.
 *
 * curl -X POST https://<host>/api/cron/cleanup \
 *   -H "Authorization: Bearer <CRON_SECRET>"
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const RETENTION_DAYS = 90

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const [conversations, executions, expiredInsights] = await Promise.all([
    prisma.aIConversation.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.aISkillExecution.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.aIInsight.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
  ])

  return NextResponse.json({
    success: true,
    retentionDays: RETENTION_DAYS,
    cutoffDate: cutoff.toISOString(),
    deleted: {
      conversations: conversations.count,
      executions: executions.count,
      expiredInsights: expiredInsights.count,
    },
  })
}
