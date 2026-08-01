import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { Prisma, PurchaseOrderStatus, SupplierStatus } from '@prisma/client'

const SUPPLIER_STATUSES = Object.values(SupplierStatus) as string[]

/** Accepts the legacy lowercase status values as well as the enum casing. */
function parseStatus(value: unknown): SupplierStatus | null {
  if (typeof value !== 'string') return null
  const upper = value.toUpperCase()
  return SUPPLIER_STATUSES.includes(upper) ? (upper as SupplierStatus) : null
}

// Orders that are placed but not yet fully received.
const PENDING_ORDER_STATUSES: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.SUBMITTED,
  PurchaseOrderStatus.APPROVED,
  PurchaseOrderStatus.ORDERED,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
]

// GET - Fetch single supplier with details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const supplier = await prisma.supplier.findFirst({
      where: { id, hospitalId, deletedAt: null },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const [items, purchaseOrders] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { preferredSupplierId: id, hospitalId, deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, sku: true, name: true, currentStock: true, purchasePrice: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { supplierId: id, deletedAt: null },
        orderBy: { orderDate: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          expectedDate: true,
          totalAmount: true,
          status: true,
        },
      }),
    ])

    const completedBusiness = purchaseOrders
      .filter((po) => po.status === PurchaseOrderStatus.RECEIVED)
      .reduce((sum, po) => sum + Number(po.totalAmount), 0)

    const pendingBusiness = purchaseOrders
      .filter((po) => PENDING_ORDER_STATUSES.includes(po.status))
      .reduce((sum, po) => sum + Number(po.totalAmount), 0)

    return NextResponse.json({
      success: true,
      data: {
        ...supplier,
        itemsSupplied: items.length,
        totalOrders: purchaseOrders.length,
        completedBusiness,
        pendingBusiness,
        itemsSuppliedList: items,
        recentPurchaseOrders: purchaseOrders.slice(0, 10),
      },
    })
  } catch (error: any) {
    console.error('Error fetching supplier:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier', details: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update supplier
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.supplier.findFirst({
      where: { id, hospitalId, deletedAt: null },
      select: { id: true, code: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await prisma.supplier.findFirst({
        where: { code: body.code, hospitalId, id: { not: id }, deletedAt: null },
        select: { id: true },
      })

      if (duplicate) {
        return NextResponse.json({ error: 'Supplier code already exists' }, { status: 409 })
      }
    }

    // COALESCE in the old SQL meant "leave alone when the field is absent",
    // while the nullable columns were always overwritten. Prisma gets the same
    // result by simply omitting undefined keys.
    const data: Prisma.SupplierUpdateInput = {
      contactPerson: body.contactPerson ?? null,
      email: body.email ?? null,
      alternatePhone: body.alternatePhone ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      pincode: body.pincode ?? null,
      gstNumber: body.gstNumber ?? null,
      panNumber: body.panNumber ?? null,
      notes: body.notes ?? null,
    }

    if (body.code != null) data.code = body.code
    if (body.name != null) data.name = body.name
    if (body.phone != null) data.phone = body.phone
    if (body.paymentTerms != null) data.paymentTerms = body.paymentTerms
    if (body.creditLimit != null) data.creditLimit = body.creditLimit
    if (body.rating != null) data.rating = body.rating

    const status = parseStatus(body.status)
    if (status) data.status = status

    await prisma.supplier.update({ where: { id }, data })

    return NextResponse.json({ success: true, message: 'Supplier updated successfully' })
  } catch (error: any) {
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to update supplier', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete when the supplier is referenced, hard delete otherwise
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

    const existing = await prisma.supplier.findFirst({
      where: { id, hospitalId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const [purchaseOrderCount, itemCount] = await Promise.all([
      prisma.purchaseOrder.count({ where: { supplierId: id } }),
      prisma.inventoryItem.count({
        where: { preferredSupplierId: id, hospitalId, deletedAt: null },
      }),
    ])

    if (purchaseOrderCount > 0 || itemCount > 0) {
      await prisma.supplier.update({
        where: { id },
        data: { deletedAt: new Date(), status: SupplierStatus.INACTIVE, isActive: false },
      })
    } else {
      await prisma.supplier.delete({ where: { id } })
    }

    return NextResponse.json({ success: true, message: 'Supplier deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json(
      { error: 'Failed to delete supplier', details: error.message },
      { status: 500 }
    )
  }
}
