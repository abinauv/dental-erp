import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const action = searchParams.get("action") || undefined
    const userId = searchParams.get("userId") || undefined
    const entity = searchParams.get("entity") || undefined
    const search = searchParams.get("q") || undefined

    const where: Record<string, unknown> = { hospitalId }
    if (action) where.action = action
    if (userId) where.userId = userId
    if (entity) where.entityType = entity
    if (search) {
      where.OR = [
        { action: { contains: search } },
        { entityType: { contains: search } },
        { oldValues: { contains: search } },
      ]
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: where as any,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where: where as any }),
    ])

    return NextResponse.json({
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        details: log.oldValues || log.newValues || null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        user: log.user
          ? { name: log.user.name, email: log.user.email, role: log.user.role }
          : null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Audit log error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
