import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { Prisma, StockAlertType } from '@prisma/client'

const ALERT_TYPES = Object.values(StockAlertType) as string[]

/** Accepts the legacy lowercase alert types as well as the enum casing. */
function parseAlertType(value: string | null): StockAlertType | null {
  if (!value) return null
  const upper = value.toUpperCase()
  return ALERT_TYPES.includes(upper) ? (upper as StockAlertType) : null
}

// GET - Fetch stock alerts
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    // Defaults to unacknowledged, matching the old query.
    const acknowledged = searchParams.get('acknowledged') || 'false'
    const alertType = parseAlertType(searchParams.get('type'))

    const where: Prisma.StockAlertWhereInput = {
      hospitalId,
      item: { deletedAt: null },
    }

    if (acknowledged === 'false') where.isAcknowledged = false
    else if (acknowledged === 'true') where.isAcknowledged = true

    if (alertType) where.alertType = alertType

    const [alerts, unacknowledged] = await Promise.all([
      prisma.stockAlert.findMany({
        where,
        orderBy: [{ alertDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          item: {
            select: {
              sku: true,
              name: true,
              currentStock: true,
              minimumStock: true,
              unit: true,
              category: { select: { name: true } },
            },
          },
          acknowledgedByUser: { select: { name: true } },
        },
      }),
      prisma.stockAlert.groupBy({
        by: ['alertType'],
        where: { hospitalId, isAcknowledged: false, item: { deletedAt: null } },
        _count: { _all: true },
      }),
    ])

    const countFor = (type: StockAlertType) =>
      unacknowledged.find((row) => row.alertType === type)?._count._all ?? 0

    return NextResponse.json({
      success: true,
      data: alerts.map(({ item, acknowledgedByUser, ...alert }) => ({
        ...alert,
        sku: item.sku,
        itemName: item.name,
        currentStock: item.currentStock,
        minimumStock: item.minimumStock,
        unit: item.unit,
        categoryName: item.category?.name ?? null,
        acknowledgedByName: acknowledgedByUser?.name ?? null,
      })),
      summary: {
        totalAlerts: unacknowledged.reduce((sum, row) => sum + row._count._all, 0),
        outOfStock: countFor(StockAlertType.OUT_OF_STOCK),
        lowStock: countFor(StockAlertType.LOW_STOCK),
        expiringSoon: countFor(StockAlertType.EXPIRING_SOON),
        expired: countFor(StockAlertType.EXPIRED),
      },
    })
  } catch (error: any) {
    console.error('Error fetching stock alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock alerts', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Acknowledge alert
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const alertId = body.alertId ?? body.alert_id
    const { notes } = body

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 })
    }

    const alert = await prisma.stockAlert.findFirst({
      where: { id: alertId, hospitalId },
      select: { id: true },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    await prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        isAcknowledged: true,
        acknowledgedBy: session?.user?.id ?? null,
        acknowledgedAt: new Date(),
        // COALESCE(?, notes) - only overwrite when notes were supplied.
        ...(notes != null ? { notes } : {}),
      },
    })

    return NextResponse.json({ success: true, message: 'Alert acknowledged successfully' })
  } catch (error: any) {
    console.error('Error acknowledging alert:', error)
    return NextResponse.json(
      { error: 'Failed to acknowledge alert', details: error.message },
      { status: 500 }
    )
  }
}
