import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/communications/analytics
 * Aggregated campaign analytics: SMS delivery rates, email open/click rates,
 * campaign comparisons, cost tracking.
 * Query params: ?period=7d|30d|90d|all
 */
export async function GET(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error) return error

  const { searchParams } = new URL(req.url)
  const period = searchParams.get("period") || "30d"

  // Calculate date range
  const now = new Date()
  let since: Date | null = null
  if (period === "7d") since = new Date(now.getTime() - 7 * 86400000)
  else if (period === "30d") since = new Date(now.getTime() - 30 * 86400000)
  else if (period === "90d") since = new Date(now.getTime() - 90 * 86400000)

  const dateFilter = since ? { gte: since } : undefined

  // SMS analytics
  const [smsStats, smsByStatus, smsByDay, smsTotalCost] = await Promise.all([
    prisma.sMSLog.count({
      where: { hospitalId: hospitalId!, createdAt: dateFilter },
    }),
    prisma.sMSLog.groupBy({
      by: ["status"],
      where: { hospitalId: hospitalId!, createdAt: dateFilter },
      _count: true,
    }),
    prisma.sMSLog.groupBy({
      by: ["createdAt"],
      where: { hospitalId: hospitalId!, createdAt: dateFilter },
      _count: true,
      orderBy: { createdAt: "asc" },
    }),
    prisma.sMSLog.aggregate({
      where: { hospitalId: hospitalId!, createdAt: dateFilter },
      _sum: { cost: true },
    }),
  ])

  const smsStatusMap: Record<string, number> = {}
  for (const s of smsByStatus) smsStatusMap[s.status] = s._count

  const smsDelivered = smsStatusMap["DELIVERED"] || 0
  const smsSent = smsStatusMap["SENT"] || 0
  const smsFailed = smsStatusMap["FAILED"] || 0
  const smsPending = smsStatusMap["PENDING"] || 0
  const smsQueued = smsStatusMap["QUEUED"] || 0
  const smsDeliveryRate = smsStats > 0 ? ((smsDelivered + smsSent) / smsStats) * 100 : 0

  // Email analytics
  const [emailStats, emailByStatus, emailOpened, emailClicked] = await Promise.all([
    prisma.emailLog.count({
      where: { hospitalId: hospitalId!, createdAt: dateFilter },
    }),
    prisma.emailLog.groupBy({
      by: ["status"],
      where: { hospitalId: hospitalId!, createdAt: dateFilter },
      _count: true,
    }),
    prisma.emailLog.count({
      where: { hospitalId: hospitalId!, createdAt: dateFilter, openedAt: { not: null } },
    }),
    prisma.emailLog.count({
      where: { hospitalId: hospitalId!, createdAt: dateFilter, clickedAt: { not: null } },
    }),
  ])

  const emailStatusMap: Record<string, number> = {}
  for (const s of emailByStatus) emailStatusMap[s.status] = s._count

  const emailSent = (emailStatusMap["SENT"] || 0) + (emailStatusMap["DELIVERED"] || 0)
  const emailFailed = emailStatusMap["FAILED"] || 0
  const emailOpenRate = emailSent > 0 ? (emailOpened / emailSent) * 100 : 0
  const emailClickRate = emailSent > 0 ? (emailClicked / emailSent) * 100 : 0

  // Aggregate SMS by day (group by date string)
  const smsDailyMap: Record<string, number> = {}
  for (const entry of smsByDay) {
    const day = new Date(entry.createdAt).toISOString().split("T")[0]
    smsDailyMap[day] = (smsDailyMap[day] || 0) + entry._count
  }

  // Email daily trend
  const emailByDay = await prisma.emailLog.groupBy({
    by: ["createdAt"],
    where: { hospitalId: hospitalId!, createdAt: dateFilter },
    _count: true,
    orderBy: { createdAt: "asc" },
  })
  const emailDailyMap: Record<string, number> = {}
  for (const entry of emailByDay) {
    const day = new Date(entry.createdAt).toISOString().split("T")[0]
    emailDailyMap[day] = (emailDailyMap[day] || 0) + entry._count
  }

  // Combine into daily trend
  const allDays = new Set([...Object.keys(smsDailyMap), ...Object.keys(emailDailyMap)])
  const dailyTrend = Array.from(allDays)
    .sort()
    .map((day) => ({
      date: day,
      sms: smsDailyMap[day] || 0,
      email: emailDailyMap[day] || 0,
    }))

  // Campaign (bulk communication) stats
  const campaigns = await prisma.bulkCommunication.findMany({
    where: { hospitalId: hospitalId!, createdAt: dateFilter },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      channel: true,
      status: true,
      recipientCount: true,
      sentCount: true,
      failedCount: true,
      estimatedCost: true,
      actualCost: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  })

  // Template performance (top 10 by usage)
  const topSmsTemplates = await prisma.sMSLog.groupBy({
    by: ["templateId"],
    where: { hospitalId: hospitalId!, createdAt: dateFilter, templateId: { not: null } },
    _count: true,
    orderBy: { _count: { templateId: "desc" } },
    take: 10,
  })

  const topEmailTemplates = await prisma.emailLog.groupBy({
    by: ["templateId"],
    where: { hospitalId: hospitalId!, createdAt: dateFilter, templateId: { not: null } },
    _count: true,
    orderBy: { _count: { templateId: "desc" } },
    take: 10,
  })

  // Fetch template names
  const templateIds = [
    ...topSmsTemplates.map((t) => t.templateId!),
    ...topEmailTemplates.map((t) => t.templateId!),
  ].filter(Boolean)

  const templates = templateIds.length > 0
    ? await prisma.communicationTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, name: true, category: true },
      })
    : []
  const templateMap = Object.fromEntries(templates.map((t) => [t.id, t]))

  return NextResponse.json({
    period,
    sms: {
      total: smsStats,
      delivered: smsDelivered,
      sent: smsSent,
      failed: smsFailed,
      pending: smsPending,
      queued: smsQueued,
      deliveryRate: Math.round(smsDeliveryRate * 10) / 10,
      totalCost: smsTotalCost._sum.cost?.toNumber() || 0,
    },
    email: {
      total: emailStats,
      sent: emailSent,
      failed: emailFailed,
      opened: emailOpened,
      clicked: emailClicked,
      openRate: Math.round(emailOpenRate * 10) / 10,
      clickRate: Math.round(emailClickRate * 10) / 10,
    },
    dailyTrend,
    campaigns: campaigns.map((c) => ({
      ...c,
      estimatedCost: c.estimatedCost?.toNumber() || 0,
      actualCost: c.actualCost?.toNumber() || 0,
    })),
    topTemplates: {
      sms: topSmsTemplates.map((t) => ({
        templateId: t.templateId,
        name: templateMap[t.templateId!]?.name || "Unknown",
        category: templateMap[t.templateId!]?.category || "GENERAL",
        count: t._count,
      })),
      email: topEmailTemplates.map((t) => ({
        templateId: t.templateId,
        name: templateMap[t.templateId!]?.name || "Unknown",
        category: templateMap[t.templateId!]?.category || "GENERAL",
        count: t._count,
      })),
    },
  })
}
