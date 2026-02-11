import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// GET - Fetch all inventory items with filters
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('category') || ''
    const status = searchParams.get('status') || 'all'
    const lowStock = searchParams.get('lowStock') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      hospitalId,
      isActive: status === 'all' ? undefined : status === 'active',
    }

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Add category filter
    if (categoryId) {
      where.categoryId = categoryId
    }

    // Fetch items with related data
    let items = await prisma.inventoryItem.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        supplierItems: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
          take: 1,
          orderBy: {
            supplierPrice: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Transform data to include stock status
    let itemsWithStatus = items.map(item => {
      let stockStatus = 'sufficient'
      if (item.currentStock <= 0) {
        stockStatus = 'out_of_stock'
      } else if (item.currentStock <= item.minimumStock) {
        stockStatus = 'low_stock'
      } else if (item.currentStock <= item.reorderLevel) {
        stockStatus = 'reorder'
      }

      return {
        ...item,
        stockStatus,
        categoryName: item.category?.name || null,
        supplierName: item.supplierItems[0]?.supplier.name || null,
        supplierItems: undefined, // Remove nested data
      }
    })

    // Apply low stock filter in memory (Prisma doesn't support field-to-field comparison in where clause)
    if (lowStock) {
      itemsWithStatus = itemsWithStatus.filter(item =>
        item.stockStatus === 'low_stock' || item.stockStatus === 'out_of_stock'
      )
    }

    // Calculate total after filtering
    const total = itemsWithStatus.length

    // Apply pagination manually
    const paginatedItems = itemsWithStatus.slice(skip, skip + limit)

    return NextResponse.json({
      success: true,
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching inventory items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory items', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Create new inventory item
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      sku,
      name,
      categoryId,
      description,
      unit,
      currentStock = 0,
      minimumStock = 0,
      reorderLevel = 0,
      maximumStock,
      purchasePrice,
      sellingPrice,
      manufacturer,
      batchTracking = false,
      expiryTracking = false,
      storageLocation,
      storageConditions,
      isActive = true,
    } = body

    // Validation
    if (!sku || !name || !unit || purchasePrice === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: sku, name, unit, purchasePrice' },
        { status: 400 }
      )
    }

    // Check if SKU already exists
    const existing = await prisma.inventoryItem.findFirst({
      where: { hospitalId, sku },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'SKU already exists' },
        { status: 409 }
      )
    }

    // Create inventory item
    const item = await prisma.inventoryItem.create({
      data: {
        hospitalId,
        sku,
        name,
        categoryId: categoryId || null,
        description: description || null,
        unit,
        currentStock,
        minimumStock,
        reorderLevel,
        maximumStock: maximumStock || null,
        purchasePrice,
        sellingPrice: sellingPrice || null,
        manufacturer: manufacturer || null,
        batchTracking,
        expiryTracking,
        storageLocation: storageLocation || null,
        storageConditions: storageConditions || null,
        isActive,
      },
    })

    // If opening stock > 0, create a stock transaction
    if (currentStock > 0) {
      await prisma.stockTransaction.create({
        data: {
          hospitalId,
          itemId: item.id,
          type: 'ADJUSTMENT_IN',
          quantity: currentStock,
          previousStock: 0,
          newStock: currentStock,
          unitPrice: purchasePrice,
          totalPrice: currentStock * purchasePrice,
          notes: 'Opening stock entry',
          performedBy: session?.user?.id || null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: item,
      message: 'Inventory item created successfully',
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to create inventory item', details: error.message },
      { status: 500 }
    )
  }
}
