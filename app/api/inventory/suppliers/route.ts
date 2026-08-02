import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { Prisma, SupplierStatus } from '@prisma/client'

const SUPPLIER_STATUSES = Object.values(SupplierStatus) as string[]

/** Accepts the legacy lowercase status values as well as the enum casing. */
function parseStatus(value: string): SupplierStatus | null {
  const upper = value.toUpperCase()
  return SUPPLIER_STATUSES.includes(upper) ? (upper as SupplierStatus) : null
}

// GET - Fetch all suppliers
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: Prisma.SupplierWhereInput = {
      hospitalId,
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { contactPerson: { contains: search } },
      ]
    }

    if (status !== 'all') {
      const parsed = parseStatus(status)
      if (parsed) where.status = parsed
    }

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          // Counts the legacy query built with COUNT(DISTINCT ...) joins.
          _count: {
            select: {
              preferredForItems: { where: { deletedAt: null } },
              purchaseOrders: { where: { deletedAt: null } },
            },
          },
          purchaseOrders: {
            where: { deletedAt: null },
            select: { totalAmount: true },
          },
        },
      }),
    ])

    const data = suppliers.map(({ _count, purchaseOrders, ...supplier }) => ({
      ...supplier,
      itemsSupplied: _count.preferredForItems,
      totalOrders: _count.purchaseOrders,
      totalBusiness: purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount), 0),
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppliers', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Create new supplier
export async function POST(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      code,
      name,
      contactPerson,
      email,
      phone,
      alternatePhone,
      address,
      city,
      state,
      pincode,
      gstNumber,
      panNumber,
      paymentTerms = 'Net 30',
      creditLimit = 0,
      status = SupplierStatus.ACTIVE,
      rating = 0,
      notes,
    } = body

    if (!code || !name || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, phone' },
        { status: 400 }
      )
    }

    const existing = await prisma.supplier.findFirst({
      where: { hospitalId, code, deletedAt: null },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({ error: 'Supplier code already exists' }, { status: 409 })
    }

    const supplier = await prisma.supplier.create({
      data: {
        hospitalId,
        code,
        name,
        contactPerson: contactPerson || null,
        email: email || null,
        phone,
        alternatePhone: alternatePhone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        gstNumber: gstNumber || null,
        panNumber: panNumber || null,
        paymentTerms,
        creditLimit,
        status: parseStatus(String(status)) ?? SupplierStatus.ACTIVE,
        rating,
        notes: notes || null,
      },
      select: { id: true },
    })

    return NextResponse.json(
      {
        success: true,
        data: { id: supplier.id },
        message: 'Supplier created successfully',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to create supplier', details: error.message },
      { status: 500 }
    )
  }
}
