import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// GET - Fetch all lab orders with filters
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const labVendorId = searchParams.get('vendor_id') || ''
    const workType = searchParams.get('work_type') || ''
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { hospitalId }

    // Add search filter
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        {
          patient: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { patientId: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          labVendor: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ]
    }

    // Add status filter
    if (status) {
      where.status = status
    }

    // Add vendor filter
    if (labVendorId) {
      where.labVendorId = labVendorId
    }

    // Add work type filter
    if (workType) {
      where.workType = workType
    }

    // Add date range filters
    if (dateFrom) {
      where.orderDate = {
        ...where.orderDate,
        gte: new Date(dateFrom),
      }
    }

    if (dateTo) {
      where.orderDate = {
        ...where.orderDate,
        lte: new Date(dateTo),
      }
    }

    // Get total count
    const total = await prisma.labOrder.count({ where })

    // Fetch orders with related data
    const orders = await prisma.labOrder.findMany({
      where,
      include: {
        labVendor: {
          select: {
            id: true,
            name: true,
            phone: true,
            avgTurnaround: true,
          },
        },
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { orderDate: 'desc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    })

    // Transform data to match expected format
    const transformedOrders = orders.map(order => ({
      ...order,
      vendorName: order.labVendor.name,
      vendorPhone: order.labVendor.phone,
      avgTurnaroundDays: order.labVendor.avgTurnaround,
      patientName: `${order.patient.firstName} ${order.patient.lastName}`,
      patientPhone: order.patient.phone,
    }))

    return NextResponse.json({
      success: true,
      data: transformedOrders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching lab orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lab orders', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Create new lab order
export async function POST(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      patientId,
      labVendorId,
      workType,
      description,
      toothNumbers,
      shadeGuide,
      orderDate,
      expectedDate,
      estimatedCost,
      notes,
    } = body

    // Validation
    if (!patientId || !labVendorId || !workType || !orderDate || estimatedCost === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: patientId, labVendorId, workType, orderDate, estimatedCost' },
        { status: 400 }
      )
    }

    // Verify patient exists and belongs to this hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    })

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    // Verify vendor exists and belongs to this hospital
    const vendor = await prisma.labVendor.findFirst({
      where: { id: labVendorId, hospitalId },
    })

    if (!vendor) {
      return NextResponse.json(
        { error: 'Lab vendor not found' },
        { status: 404 }
      )
    }

    // Generate order number unique to this hospital
    const year = new Date().getFullYear()
    const lastOrder = await prisma.labOrder.findFirst({
      where: {
        hospitalId,
        orderNumber: {
          startsWith: `LAB${year}`,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
    })

    let orderNumber = `LAB${year}0001`
    if (lastOrder) {
      const lastNumber = parseInt(lastOrder.orderNumber.slice(-4))
      const nextNumber = (lastNumber + 1).toString().padStart(4, '0')
      orderNumber = `LAB${year}${nextNumber}`
    }

    // Create lab order
    const labOrder = await prisma.labOrder.create({
      data: {
        hospitalId,
        orderNumber,
        patientId,
        labVendorId,
        workType,
        description: description || null,
        toothNumbers: toothNumbers || null,
        shadeGuide: shadeGuide || null,
        orderDate: new Date(orderDate),
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        estimatedCost,
        status: 'CREATED',
        qualityCheck: null,
        notes: notes || null,
      },
      include: {
        patient: {
          select: {
            patientId: true,
            firstName: true,
            lastName: true,
          },
        },
        labVendor: {
          select: {
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: labOrder,
      message: 'Lab order created successfully',
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating lab order:', error)
    return NextResponse.json(
      { error: 'Failed to create lab order', details: error.message },
      { status: 500 }
    )
  }
}
