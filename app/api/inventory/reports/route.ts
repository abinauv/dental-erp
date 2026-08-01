import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { StockTransactionType, SupplierStatus } from '@prisma/client'

/**
 * These reports multiply columns together (SUM(stock * price)) and do date
 * arithmetic (DATEDIFF), neither of which Prisma expresses. The rows are
 * fetched and reduced in JS instead - the working set is one hospital's
 * inventory, which is small enough that this is not worth raw SQL.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY)
}

// Stock movements in and out, matching the legacy type groupings.
const INBOUND_TYPES: StockTransactionType[] = [
  StockTransactionType.PURCHASE,
  StockTransactionType.ADJUSTMENT_IN,
]
const OUTBOUND_TYPES: StockTransactionType[] = [
  StockTransactionType.SALE,
  StockTransactionType.ADJUSTMENT_OUT,
  StockTransactionType.DAMAGED,
  StockTransactionType.EXPIRED,
  StockTransactionType.RETURNED,
  StockTransactionType.CONSUMPTION,
]

// GET - Generate inventory reports
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const reportType = searchParams.get('type') || 'summary'

    switch (reportType) {
      case 'summary':
        return await getInventorySummary(hospitalId)
      case 'low_stock':
        return await getLowStockReport(hospitalId)
      case 'expiring':
        return await getExpiringItemsReport(hospitalId, searchParams)
      case 'stock_valuation':
        return await getStockValuationReport(hospitalId)
      case 'dead_stock':
        return await getDeadStockReport(hospitalId, searchParams)
      case 'movement':
        return await getStockMovementReport(hospitalId, searchParams)
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error generating inventory report:', error)
    return NextResponse.json(
      { error: 'Failed to generate inventory report', details: error.message },
      { status: 500 }
    )
  }
}

// Inventory Summary Report
async function getInventorySummary(hospitalId: string) {
  const [items, activeSuppliers, pendingAlerts] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { hospitalId, deletedAt: null },
      select: {
        isActive: true,
        currentStock: true,
        minimumStock: true,
        purchasePrice: true,
        itemType: true,
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.supplier.count({
      where: { hospitalId, deletedAt: null, status: SupplierStatus.ACTIVE },
    }),
    prisma.stockAlert.count({
      where: { hospitalId, isAcknowledged: false, item: { deletedAt: null } },
    }),
  ])

  const valueOf = (i: (typeof items)[number]) => i.currentStock * Number(i.purchasePrice)

  const summary = {
    totalItems: items.length,
    activeItems: items.filter((i) => i.isActive).length,
    outOfStockItems: items.filter((i) => i.currentStock <= 0).length,
    lowStockItems: items.filter((i) => i.currentStock > 0 && i.currentStock <= i.minimumStock)
      .length,
    totalInventoryValue: items.reduce((sum, i) => sum + valueOf(i), 0),
    activeSuppliers,
    pendingAlerts,
  }

  const byCategory = new Map<
    string,
    { category: string | null; itemCount: number; categoryValue: number }
  >()
  for (const item of items) {
    const key = item.category?.id ?? '__uncategorised__'
    const row = byCategory.get(key) ?? {
      category: item.category?.name ?? null,
      itemCount: 0,
      categoryValue: 0,
    }
    row.itemCount += 1
    row.categoryValue += valueOf(item)
    byCategory.set(key, row)
  }

  const byType = new Map<string, { itemType: string; itemCount: number; typeValue: number }>()
  for (const item of items) {
    const row = byType.get(item.itemType) ?? {
      itemType: item.itemType,
      itemCount: 0,
      typeValue: 0,
    }
    row.itemCount += 1
    row.typeValue += valueOf(item)
    byType.set(item.itemType, row)
  }

  return NextResponse.json({
    success: true,
    data: {
      summary,
      categoryBreakdown: [...byCategory.values()].sort((a, b) => b.categoryValue - a.categoryValue),
      typeBreakdown: [...byType.values()].sort((a, b) => b.typeValue - a.typeValue),
    },
  })
}

// Low Stock Report
async function getLowStockReport(hospitalId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { hospitalId, deletedAt: null, isActive: true },
    select: {
      id: true,
      sku: true,
      name: true,
      currentStock: true,
      minimumStock: true,
      reorderLevel: true,
      unit: true,
      purchasePrice: true,
      category: { select: { name: true } },
      preferredSupplier: { select: { name: true, phone: true } },
    },
    orderBy: { name: 'asc' },
  })

  // Prisma cannot compare two columns in a where clause, so the
  // `current_stock <= reorder_point` filter happens here.
  const lowStock = items
    .filter((i) => i.currentStock <= i.reorderLevel)
    .map(({ category, preferredSupplier, ...item }) => {
      let urgency: string
      if (item.currentStock <= 0) urgency = 'out_of_stock'
      else if (item.currentStock <= item.minimumStock) urgency = 'critical'
      else urgency = 'low'

      return {
        ...item,
        categoryName: category?.name ?? null,
        supplierName: preferredSupplier?.name ?? null,
        supplierPhone: preferredSupplier?.phone ?? null,
        urgency,
        suggestedOrderQuantity: item.reorderLevel - item.currentStock,
      }
    })

  const rank = (urgency: string) =>
    urgency === 'out_of_stock' ? 1 : urgency === 'critical' ? 2 : 3

  lowStock.sort((a, b) => rank(a.urgency) - rank(b.urgency) || a.name.localeCompare(b.name))

  return NextResponse.json({ success: true, data: lowStock })
}

// Expiring Items Report
async function getExpiringItemsReport(hospitalId: string, searchParams: URLSearchParams) {
  const daysAhead = parseInt(searchParams.get('days') || '30')
  const today = startOfToday()
  const cutoff = new Date(today.getTime() + daysAhead * MS_PER_DAY)

  const batches = await prisma.inventoryBatch.findMany({
    where: {
      hospitalId,
      remainingQty: { gt: 0 },
      item: { deletedAt: null },
    },
    select: {
      batchNumber: true,
      expiryDate: true,
      remainingQty: true,
      item: {
        select: { id: true, sku: true, name: true, unit: true, purchasePrice: true },
      },
    },
    orderBy: { expiryDate: 'asc' },
  })

  const withExpiry = batches.filter(
    (b): b is typeof b & { expiryDate: Date } => b.expiryDate != null
  )

  const items = withExpiry
    .filter((b) => b.expiryDate <= cutoff)
    .map((b) => {
      const daysToExpiry = daysBetween(today, b.expiryDate)
      let urgency: string
      if (daysToExpiry < 0) urgency = 'expired'
      else if (daysToExpiry <= 7) urgency = 'critical'
      else if (daysToExpiry <= 30) urgency = 'warning'
      else urgency = 'normal'

      return {
        id: b.item.id,
        sku: b.item.sku,
        name: b.item.name,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        remainingQty: b.remainingQty,
        unit: b.item.unit,
        purchasePrice: b.item.purchasePrice,
        valueAtRisk: b.remainingQty * Number(b.item.purchasePrice),
        daysToExpiry,
        urgency,
      }
    })

  // The legacy summary spans every batch on hand, not just those inside the
  // requested window.
  const summary = withExpiry.reduce(
    (acc, b) => {
      const value = b.remainingQty * Number(b.item.purchasePrice)
      const days = daysBetween(today, b.expiryDate)
      if (days < 0) {
        acc.expiredBatches += 1
        acc.expiredValue += value
      } else if (days <= daysAhead) {
        acc.expiringSoonBatches += 1
        acc.expiringSoonValue += value
      }
      return acc
    },
    { expiredBatches: 0, expiredValue: 0, expiringSoonBatches: 0, expiringSoonValue: 0 }
  )

  return NextResponse.json({ success: true, data: { summary, items } })
}

// Stock Valuation Report
async function getStockValuationReport(hospitalId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { hospitalId, deletedAt: null, currentStock: { gt: 0 } },
    select: {
      id: true,
      sku: true,
      name: true,
      currentStock: true,
      unit: true,
      purchasePrice: true,
      itemType: true,
      category: { select: { name: true } },
    },
  })

  const valuation = items
    .map(({ category, ...item }) => ({
      ...item,
      categoryName: category?.name ?? null,
      stockValue: item.currentStock * Number(item.purchasePrice),
    }))
    .sort((a, b) => b.stockValue - a.stockValue)

  const totalValue = valuation.reduce((sum, i) => sum + i.stockValue, 0)

  return NextResponse.json({
    success: true,
    data: {
      totals: {
        totalValue,
        itemsInStock: valuation.length,
        averageItemValue: valuation.length ? totalValue / valuation.length : 0,
      },
      items: valuation,
    },
  })
}

// Dead Stock Report (items with no movement in specified days)
async function getDeadStockReport(hospitalId: string, searchParams: URLSearchParams) {
  const days = parseInt(searchParams.get('days') || '90')
  const today = startOfToday()

  const items = await prisma.inventoryItem.findMany({
    where: { hospitalId, deletedAt: null, currentStock: { gt: 0 } },
    select: {
      id: true,
      sku: true,
      name: true,
      currentStock: true,
      unit: true,
      purchasePrice: true,
      category: { select: { name: true } },
      stockTransactions: {
        select: { transactionDate: true },
        orderBy: { transactionDate: 'desc' },
        take: 1,
      },
    },
  })

  const deadStock = items
    .map(({ category, stockTransactions, ...item }) => {
      const lastTransactionDate = stockTransactions[0]?.transactionDate ?? null
      return {
        ...item,
        categoryName: category?.name ?? null,
        lockedValue: item.currentStock * Number(item.purchasePrice),
        lastTransactionDate,
        daysSinceLastMovement: lastTransactionDate ? daysBetween(lastTransactionDate, today) : null,
      }
    })
    .filter((i) => i.daysSinceLastMovement === null || i.daysSinceLastMovement > days)
    .sort((a, b) => b.lockedValue - a.lockedValue)

  return NextResponse.json({ success: true, data: deadStock })
}

// Stock Movement Report
async function getStockMovementReport(hospitalId: string, searchParams: URLSearchParams) {
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'Start date and end date are required for movement report' },
      { status: 400 }
    )
  }

  const transactions = await prisma.stockTransaction.findMany({
    where: {
      hospitalId,
      transactionDate: { gte: new Date(startDate), lte: new Date(endDate) },
      item: { deletedAt: null },
    },
    select: {
      type: true,
      quantity: true,
      item: {
        select: { id: true, sku: true, name: true, currentStock: true, unit: true },
      },
    },
  })

  const byItem = new Map<
    string,
    {
      id: string
      sku: string
      name: string
      currentStock: number
      unit: string
      totalIn: number
      totalOut: number
      transactionCount: number
    }
  >()

  for (const tx of transactions) {
    const row = byItem.get(tx.item.id) ?? {
      id: tx.item.id,
      sku: tx.item.sku,
      name: tx.item.name,
      currentStock: tx.item.currentStock,
      unit: tx.item.unit,
      totalIn: 0,
      totalOut: 0,
      transactionCount: 0,
    }
    if (INBOUND_TYPES.includes(tx.type)) row.totalIn += tx.quantity
    else if (OUTBOUND_TYPES.includes(tx.type)) row.totalOut += tx.quantity
    row.transactionCount += 1
    byItem.set(tx.item.id, row)
  }

  const movement = [...byItem.values()].sort((a, b) => b.transactionCount - a.transactionCount)

  return NextResponse.json({ success: true, data: movement })
}
