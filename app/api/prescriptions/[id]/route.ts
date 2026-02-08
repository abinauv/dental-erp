import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// GET — single prescription with medications
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const prescription = await prisma.prescription.findFirst({
      where: { id, hospitalId },
      include: {
        patient: {
          select: {
            id: true, patientId: true, firstName: true, lastName: true,
            phone: true, email: true, dateOfBirth: true, gender: true,
            address: true, city: true, allergies: true,
          },
        },
        doctor: { select: { id: true, name: true, specialization: true, registrationNo: true } },
        medications: {
          include: { medication: { select: { id: true, name: true, genericName: true } } },
        },
      },
    })

    if (!prescription) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
    }

    // Also fetch hospital info for the print view
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        name: true, tagline: true, phone: true, email: true,
        address: true, city: true, state: true, pincode: true,
        logo: true, registrationNo: true,
      },
    })

    return NextResponse.json({ success: true, data: prescription, hospital })
  } catch (err: any) {
    console.error('Error fetching prescription:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch prescription' }, { status: 500 })
  }
}

// DELETE — delete prescription
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const existing = await prisma.prescription.findFirst({ where: { id, hospitalId } })
    if (!existing) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
    }

    await prisma.prescription.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Prescription deleted' })
  } catch (err: any) {
    console.error('Error deleting prescription:', err)
    return NextResponse.json({ error: err.message || 'Failed to delete prescription' }, { status: 500 })
  }
}
