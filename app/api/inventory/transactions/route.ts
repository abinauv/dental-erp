import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { Prisma, StockAlertType, StockTransactionType } from '@prisma/client'

const TRANSACTION_TYPES = Object.values(StockTransactionType) as string[]

/**
 * Which way each transaction type moves stock.
 *
 * RETURNED subtracts: in the legacy switch 'return' sat with sale/usage/wastage,
 * i.e. stock going back to the supplier rather than coming back from a patient.
 * TRANSFERRED is net-neutral - it moves stock between fromLocation and
 * toLocation without changing the total on hand.
 */
const INBOUND: StockTransactionType[] = [
  StockTransactionType.PURCHASE,
  StockTransactionType.ADJUSTMENT_IN,
]
const OUTBOUND: StockTransactionType[] = [
  StockTransactionType.SALE,
  StockTransactionType.ADJUSTMENT_OUT,
  StockTransactionType.DAMAGED,
  StockTransactionType.EXPIRED,
  StockTransactionType.RETURNED,
  StockTransactionType.CONSUMPTION,
]

function parseType(value: unknown): StockTransactionType | null {
  if (typeof value !== 'string') return null
  const upper = value.toUpperCase()
  return TRANSACTION_TYPES.includes(upper) ? (upper as StockTransactionType) : null
}

// GET - Fetch stock transactions
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const itemId = searchParams.get('itemId')
    const transactionType = parseType(searchParams.get('type'))
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: Prisma.StockTransactionWhereInput = { hospitalId }

    if (itemId) where.itemId = itemId
    if (transactionType) where.type = transactionType

    if (startDate || endDate) {
      where.transactionDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [total, transactions] = await Promise.all([
      prisma.stockTransaction.count({ where }),
      prisma.stockTransaction.findMany({
        where,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          item: { select: { name: true, sku: true } },
          supplier: { select: { name: true } },
          batch: { select: { batchNumber: true } },
        },
      }),
    ])

    // performedBy is a bare user id, so resolve names in one extra query.
    const performerIds = [...new Set(transactions.map((t) => t.performedBy).filter(Boolean))]
    const performers = performerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: performerIds as string[] } },
          select: { id: true, name: true },
        })
      : []
    const performerNames = new Map(performers.map((u) => [u.id, u.name]))

    return NextResponse.json({
      success: true,
      data: transactions.map(({ item, supplier, batch, ...tx }) => ({
        ...tx,
        itemName: item.name,
        sku: item.sku,
        supplierName: supplier?.name ?? null,
        batchNumber: batch?.batchNumber ?? tx.batchNumber ?? null,
        performedByName: tx.performedBy ? (performerNames.get(tx.performedBy) ?? null) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching stock transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock transactions', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Create stock transaction (adjustment, usage, wastage, etc.)
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      itemId,
      batchId,
      quantity,
      unitPrice,
      transactionDate,
      referenceType,
      referenceId,
      fromLocation,
      toLocation,
      supplierId,
      notes,
    } = body

    const type = parseType(body.type)

    if (!type || !itemId || !quantity || !transactionDate) {
      return NextResponse.json(
        { error: 'Missing required fields: type, itemId, quantity, transactionDate' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'quantity must be a positive whole number' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: itemId, hospitalId, deletedAt: null },
        select: {
          id: true,
          currentStock: true,
          minimumStock: true,
          purchasePrice: true,
        },
      })

      if (!item) {
        return { status: 404 as const, error: 'Inventory item not found' }
      }

      const previousStock = item.currentStock
      let newStock = previousStock

      if (INBOUND.includes(type)) newStock += quantity
      else if (OUTBOUND.includes(type)) newStock -= quantity
      // TRANSFERRED leaves the total unchanged.

      if (newStock < 0) {
        return { status: 400 as const, error: 'Insufficient stock for this transaction' }
      }

      const effectiveUnitPrice = unitPrice ?? Number(item.purchasePrice)

      const created = await tx.stockTransaction.create({
        data: {
          hospitalId,
          itemId,
          batchId: batchId || null,
          type,
          quantity,
          previousStock,
          newStock,
          unitPrice: effectiveUnitPrice,
          totalPrice: quantity * effectiveUnitPrice,
          transactionDate: new Date(transactionDate),
          referenceType: referenceType || null,
          referenceId: referenceId || null,
          fromLocation: fromLocation || null,
          toLocation: toLocation || null,
          supplierId: supplierId || null,
          performedBy: session?.user?.id ?? null,
          notes: notes || null,
        },
        select: { id: true },
      })

      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { currentStock: newStock },
      })

      if (batchId) {
        await tx.inventoryBatch.update({
          where: { id: batchId },
          data: {
            remainingQty: OUTBOUND.includes(type)
              ? { decrement: quantity }
              : { increment: quantity },
          },
        })
      }

      if (newStock <= item.minimumStock) {
        const alertType = newStock <= 0 ? StockAlertType.OUT_OF_STOCK : StockAlertType.LOW_STOCK

        const openAlert = await tx.stockAlert.findFirst({
          where: { itemId, alertType, isAcknowledged: false },
          select: { id: true },
        })

        if (!openAlert) {
          await tx.stockAlert.create({ data: { hospitalId, itemId, alertType } })
        }
      } else {
        // Stock is healthy again - clear the open shortage alerts.
        await tx.stockAlert.deleteMany({
          where: {
            itemId,
            alertType: { in: [StockAlertType.LOW_STOCK, StockAlertType.OUT_OF_STOCK] },
            isAcknowledged: false,
          },
        })
      }

      return { status: 201 as const, id: created.id, newStock }
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(
      {
        success: true,
        data: { id: result.id, newStock: result.newStock },
        message: 'Stock transaction recorded successfully',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating stock transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create stock transaction', details: error.message },
      { status: 500 }
    )
  }
}
