import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { LabVendorStatus } from '@prisma/client'

const VENDOR_STATUSES = Object.values(LabVendorStatus) as string[]

/** Accepts the legacy lowercase status values as well as the enum casing. */
function parseStatus(value: unknown): LabVendorStatus | null {
  if (typeof value !== 'string') return null
  const upper = value.toUpperCase()
  return VENDOR_STATUSES.includes(upper) ? (upper as LabVendorStatus) : null
}

// GET - Fetch single lab vendor
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const vendor = await prisma.labVendor.findFirst({
      where: { id, hospitalId, deletedAt: null },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Lab vendor not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: vendor })
  } catch (error: any) {
    console.error('Error fetching lab vendor:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lab vendor', details: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update lab vendor
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.labVendor.findFirst({
      where: { id, hospitalId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lab vendor not found' }, { status: 404 })
    }

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
      specializations,
      avgTurnaround,
      rating,
      paymentTerms,
      creditLimit,
      notes,
    } = body

    if (!code || !name || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, phone' },
        { status: 400 }
      )
    }

    const duplicate = await prisma.labVendor.findFirst({
      where: { code, hospitalId, id: { not: id }, deletedAt: null },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json({ error: 'Vendor code already exists' }, { status: 409 })
    }

    await prisma.labVendor.update({
      where: { id },
      data: {
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
        specializations: specializations || null,
        avgTurnaround: avgTurnaround ?? null,
        rating: rating ?? null,
        paymentTerms: paymentTerms ?? null,
        creditLimit: creditLimit ?? null,
        notes: notes || null,
        ...(parseStatus(body.status) ? { status: parseStatus(body.status)! } : {}),
      },
    })

    return NextResponse.json({ success: true, message: 'Lab vendor updated successfully' })
  } catch (error: any) {
    console.error('Error updating lab vendor:', error)
    return NextResponse.json(
      { error: 'Failed to update lab vendor', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete lab vendor
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

    const existing = await prisma.labVendor.findFirst({
      where: { id, hospitalId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lab vendor not found' }, { status: 404 })
    }

    const orderCount = await prisma.labOrder.count({
      where: { labVendorId: id, deletedAt: null },
    })

    if (orderCount > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete vendor with existing lab orders. Please inactive the vendor instead.',
        },
        { status: 400 }
      )
    }

    await prisma.labVendor.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true, message: 'Lab vendor deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting lab vendor:', error)
    return NextResponse.json(
      { error: 'Failed to delete lab vendor', details: error.message },
      { status: 500 }
    )
  }
}
