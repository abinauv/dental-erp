import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { Prisma, StockAlertType, StockTransactionType } from '@prisma/client'

function stockStatus(currentStock: number, minimumStock: number, reorderLevel: number) {
  if (currentStock <= 0) return 'out_of_stock'
  if (currentStock <= minimumStock) return 'low_stock'
  if (currentStock <= reorderLevel) return 'reorder'
  return 'sufficient'
}

// GET - Fetch single inventory item
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const item = await prisma.inventoryItem.findFirst({
      where: { id, hospitalId, deletedAt: null },
      include: {
        category: { select: { name: true } },
        preferredSupplier: { select: { name: true, phone: true, email: true } },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [batchCount, purchases, usage, batches, transactions] = await Promise.all([
      prisma.inventoryBatch.count({ where: { itemId: id } }),
      prisma.stockTransaction.aggregate({
        _sum: { quantity: true },
        where: {
          itemId: id,
          type: StockTransactionType.PURCHASE,
          transactionDate: { gte: thirtyDaysAgo },
        },
      }),
      prisma.stockTransaction.aggregate({
        _sum: { quantity: true },
        where: {
          itemId: id,
          // The legacy query counted 'sale' and 'usage'; 'usage' is CONSUMPTION here.
          type: { in: [StockTransactionType.SALE, StockTransactionType.CONSUMPTION] },
          transactionDate: { gte: thirtyDaysAgo },
        },
      }),
      item.batchTracking
        ? prisma.inventoryBatch.findMany({
            where: { itemId: id },
            orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'desc' }],
            include: { supplier: { select: { name: true } } },
          })
        : Promise.resolve([]),
      prisma.stockTransaction.findMany({
        where: { itemId: id },
        orderBy: { transactionDate: 'desc' },
        take: 20,
        include: { supplier: { select: { name: true } } },
      }),
    ])

    // performedBy is a bare user id, so resolve the names in one extra query
    // rather than a relation the model does not declare.
    const performerIds = [...new Set(transactions.map((t) => t.performedBy).filter(Boolean))]
    const performers = performerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: performerIds as string[] } },
          select: { id: true, name: true },
        })
      : []
    const performerNames = new Map(performers.map((u) => [u.id, u.name]))

    const { category, preferredSupplier, ...rest } = item

    return NextResponse.json({
      success: true,
      data: {
        ...rest,
        categoryName: category?.name ?? null,
        supplierName: preferredSupplier?.name ?? null,
        supplierPhone: preferredSupplier?.phone ?? null,
        supplierEmail: preferredSupplier?.email ?? null,
        stockStatus: stockStatus(item.currentStock, item.minimumStock, item.reorderLevel),
        batchCount,
        purchasesLast30Days: purchases._sum.quantity ?? 0,
        usageLast30Days: usage._sum.quantity ?? 0,
        batches: batches.map(({ supplier, ...batch }) => ({
          ...batch,
          supplierName: supplier?.name ?? null,
        })),
        recentTransactions: transactions.map(({ supplier, ...tx }) => ({
          ...tx,
          supplierName: supplier?.name ?? null,
          performedByName: tx.performedBy ? (performerNames.get(tx.performedBy) ?? null) : null,
        })),
      },
    })
  } catch (error: any) {
    console.error('Error fetching inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory item', details: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update inventory item
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.inventoryItem.findFirst({
      where: { id, hospitalId, deletedAt: null },
      select: { id: true, sku: true, currentStock: true, minimumStock: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }

    if (body.sku && body.sku !== existing.sku) {
      const duplicate = await prisma.inventoryItem.findFirst({
        where: { sku: body.sku, hospitalId, id: { not: id }, deletedAt: null },
        select: { id: true },
      })

      if (duplicate) {
        return NextResponse.json({ error: 'Item code already exists' }, { status: 409 })
      }
    }

    // Nullable columns were unconditionally overwritten by the old UPDATE;
    // the COALESCE'd ones were left alone when absent.
    const data: Prisma.InventoryItemUpdateInput = {
      description: body.description ?? null,
      maximumStock: body.maximumStock ?? null,
      hsnCode: body.hsnCode ?? null,
      storageLocation: body.storageLocation ?? null,
      imageUrl: body.imageUrl ?? null,
      notes: body.notes ?? null,
    }

    if (body.sku != null) data.sku = body.sku
    if (body.name != null) data.name = body.name
    if (body.itemType != null) data.itemType = body.itemType
    if (body.unit != null) data.unit = body.unit
    if (body.minimumStock != null) data.minimumStock = body.minimumStock
    if (body.reorderLevel != null) data.reorderLevel = body.reorderLevel
    if (body.purchasePrice != null) data.purchasePrice = body.purchasePrice
    if (body.sellingPrice != null) data.sellingPrice = body.sellingPrice
    if (body.taxPercentage != null) data.taxPercentage = body.taxPercentage
    if (body.expiryTracking != null) data.expiryTracking = body.expiryTracking
    if (body.batchTracking != null) data.batchTracking = body.batchTracking
    if (body.isActive != null) data.isActive = body.isActive

    data.category = body.categoryId ? { connect: { id: body.categoryId } } : { disconnect: true }
    data.preferredSupplier = body.preferredSupplierId
      ? { connect: { id: body.preferredSupplierId } }
      : { disconnect: true }

    await prisma.inventoryItem.update({ where: { id }, data })

    // Raise a stock alert if the new minimum puts the item at or below it.
    const updatedMinStock = body.minimumStock ?? existing.minimumStock
    const currentStock = existing.currentStock

    if (currentStock <= updatedMinStock) {
      const alertType = currentStock <= 0 ? StockAlertType.OUT_OF_STOCK : StockAlertType.LOW_STOCK

      const openAlert = await prisma.stockAlert.findFirst({
        where: { itemId: id, alertType, isAcknowledged: false },
        select: { id: true },
      })

      if (!openAlert) {
        await prisma.stockAlert.create({
          data: { hospitalId, itemId: id, alertType },
        })
      }
    }

    return NextResponse.json({ success: true, message: 'Inventory item updated successfully' })
  } catch (error: any) {
    console.error('Error updating inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory item', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete when the item has transaction history, hard delete otherwise
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const existing = await prisma.inventoryItem.findFirst({
      where: { id, hospitalId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }

    const transactionCount = await prisma.stockTransaction.count({ where: { itemId: id } })

    if (transactionCount > 0) {
      await prisma.inventoryItem.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      })
    } else {
      // Alerts cascade; batches would block the delete, so clear them first.
      await prisma.$transaction([
        prisma.inventoryBatch.deleteMany({ where: { itemId: id } }),
        prisma.inventoryItem.delete({ where: { id } }),
      ])
    }

    return NextResponse.json({ success: true, message: 'Inventory item deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to delete inventory item', details: error.message },
      { status: 500 }
    )
  }
}
