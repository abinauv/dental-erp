import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// GET — single medication
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
    const medication = await prisma.medication.findFirst({
      where: { id, hospitalId },
    })

    if (!medication) {
      return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: medication })
  } catch (err: any) {
    console.error('Error fetching medication:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch medication' }, { status: 500 })
  }
}

// PUT — update medication
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const existing = await prisma.medication.findFirst({ where: { id, hospitalId } })
    if (!existing) {
      return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
    }

    const body = await request.json()
    const medication = await prisma.medication.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        genericName: body.genericName ?? existing.genericName,
        category: body.category ?? existing.category,
        form: body.form ?? existing.form,
        strength: body.strength ?? existing.strength,
        manufacturer: body.manufacturer ?? existing.manufacturer,
        defaultDosage: body.defaultDosage ?? existing.defaultDosage,
        defaultFrequency: body.defaultFrequency ?? existing.defaultFrequency,
        defaultDuration: body.defaultDuration ?? existing.defaultDuration,
        contraindications: body.contraindications ?? existing.contraindications,
        sideEffects: body.sideEffects ?? existing.sideEffects,
        isActive: body.isActive ?? existing.isActive,
      },
    })

    return NextResponse.json({ success: true, data: medication })
  } catch (err: any) {
    console.error('Error updating medication:', err)
    return NextResponse.json({ error: err.message || 'Failed to update medication' }, { status: 500 })
  }
}

// DELETE — deactivate medication (soft)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const existing = await prisma.medication.findFirst({ where: { id, hospitalId } })
    if (!existing) {
      return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
    }

    await prisma.medication.update({ where: { id }, data: { isActive: false } })

    return NextResponse.json({ success: true, message: 'Medication deactivated' })
  } catch (err: any) {
    console.error('Error deleting medication:', err)
    return NextResponse.json({ error: err.message || 'Failed to delete medication' }, { status: 500 })
  }
}
