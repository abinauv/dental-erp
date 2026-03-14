import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// GET - Fetch all lab vendors
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
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { hospitalId }

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Add status filter
    if (status !== 'all') {
      where.isActive = status === 'active'
    }

    // Get total count
    const total = await prisma.labVendor.count({ where })

    // Fetch vendors
    const vendors = await prisma.labVendor.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
      skip,
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: vendors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching lab vendors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lab vendors', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Create new lab vendor
export async function POST(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      specializations,
      avgTurnaround = 7,
      rating = 0,
      isActive = true,
    } = body

    // Validation
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone' },
        { status: 400 }
      )
    }

    // Create lab vendor
    const vendor = await prisma.labVendor.create({
      data: {
        hospitalId,
        name,
        contactPerson: contactPerson || null,
        phone,
        email: email || null,
        address: address || null,
        specializations: specializations || null,
        avgTurnaround: avgTurnaround || null,
        rating: rating || null,
        isActive,
      },
    })

    return NextResponse.json({
      success: true,
      data: vendor,
      message: 'Lab vendor created successfully',
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating lab vendor:', error)
    return NextResponse.json(
      { error: 'Failed to create lab vendor', details: error.message },
      { status: 500 }
    )
  }
}
