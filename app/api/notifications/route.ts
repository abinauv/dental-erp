import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedHospital } from "@/lib/api-helpers"

// GET /api/notifications — list notifications for current user
export async function GET(req: NextRequest) {
  const { error, user, hospitalId } = await getAuthenticatedHospital()
  if (error || !user || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get("unread") === "true"
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50)
  const cursor = searchParams.get("cursor") || undefined

  const where: Record<string, unknown> = {
    hospitalId,
    userId: user.id,
  }

  if (unreadOnly) {
    where.isRead = false
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = notifications.length > limit
  if (hasMore) notifications.pop()

  const unreadCount = await prisma.notification.count({
    where: { hospitalId, userId: user.id, isRead: false },
  })

  return NextResponse.json({
    notifications,
    unreadCount,
    nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
  })
}

// PUT /api/notifications — mark notifications as read
export async function PUT(req: NextRequest) {
  const { error, user, hospitalId } = await getAuthenticatedHospital()
  if (error || !user || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { ids, all } = body as { ids?: string[]; all?: boolean }

  const now = new Date()

  if (all) {
    await prisma.notification.updateMany({
      where: { hospitalId, userId: user.id, isRead: false },
      data: { isRead: true, readAt: now },
    })
  } else if (ids && ids.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, hospitalId, userId: user.id },
      data: { isRead: true, readAt: now },
    })
  } else {
    return NextResponse.json({ error: "Provide 'ids' array or 'all: true'" }, { status: 400 })
  }

  const unreadCount = await prisma.notification.count({
    where: { hospitalId, userId: user.id, isRead: false },
  })

  return NextResponse.json({ success: true, unreadCount })
}
