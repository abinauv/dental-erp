import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { translateError } from '@/lib/i18n/api-messages'

const MAX_LIMIT = 100

/** An entry's stored values: an object of fields (lib/audit-log), or older free text. */
function values(text: string | null): Record<string, unknown> | null {
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

// GET /api/audit-log — the clinic's audit log for Reports → Audit Log, newest
// first. Admins only.
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN'])
  if (error || !hospitalId) {
    return (
      error || NextResponse.json({ error: await translateError('Unauthorized') }, { status: 401 })
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') || '50') || 50)
    )
    const action = searchParams.get('action') || undefined
    const userId = searchParams.get('userId') || undefined
    const entity = searchParams.get('entity') || undefined
    const entityId = searchParams.get('entityId') || undefined
    const search = searchParams.get('q')?.trim() || undefined

    const where: Record<string, unknown> = { hospitalId }
    if (action) where.action = action
    if (userId) where.userId = userId
    if (entity) where.entityType = entity
    if (entityId) where.entityId = entityId
    if (search) {
      where.OR = [
        { action: { contains: search } },
        { entityType: { contains: search } },
        { entityLabel: { contains: search } },
        { entityId: search },
        { oldValues: { contains: search } },
        { newValues: { contains: search } },
        { user: { name: { contains: search } } },
      ]
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where: where as any }),
    ])

    return NextResponse.json({
      data: logs.map((log) => {
        const oldValues = values(log.oldValues)
        const newValues = values(log.newValues)
        return {
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          entityLabel: log.entityLabel,
          oldValues,
          newValues,
          // Entries that store free text rather than fields.
          details: oldValues || newValues ? null : log.oldValues || log.newValues || null,
          source: log.source,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt,
          user: log.user
            ? { name: log.user.name, email: log.user.email, role: log.user.role }
            : null,
        }
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    logger.error({ err }, 'Audit log error:')
    return NextResponse.json(
      { error: await translateError('Internal server error') },
      { status: 500 }
    )
  }
}
