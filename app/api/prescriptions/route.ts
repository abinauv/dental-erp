import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// GET — list prescriptions
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sp = request.nextUrl.searchParams
    const search = sp.get('search') || ''
    const patientId = sp.get('patientId') || ''
    const doctorId = sp.get('doctorId') || ''
    const page = parseInt(sp.get('page') || '1')
    const limit = parseInt(sp.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = { hospitalId }

    if (search) {
      where.OR = [
        { prescriptionNo: { contains: search, mode: 'insensitive' } },
        { patient: { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { patientId: { contains: search, mode: 'insensitive' } },
        ] } },
      ]
    }

    if (patientId) where.patientId = patientId
    if (doctorId) where.doctorId = doctorId

    const [prescriptions, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        include: {
          patient: { select: { id: true, patientId: true, firstName: true, lastName: true, phone: true, dateOfBirth: true } },
          doctor: { select: { id: true, firstName: true, lastName: true } },
          medications: { include: { medication: { select: { id: true, name: true, genericName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.prescription.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: prescriptions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err: any) {
    console.error('Error fetching prescriptions:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch prescriptions' }, { status: 500 })
  }
}

// POST — create prescription
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { patientId, diagnosis, notes, validUntil, medications } = body

    if (!patientId || !medications || medications.length === 0) {
      return NextResponse.json({ error: 'Patient and at least one medication are required' }, { status: 400 })
    }

    // Verify patient
    const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Generate prescription number
    const year = new Date().getFullYear()
    const lastRx = await prisma.prescription.findFirst({
      where: { hospitalId, prescriptionNo: { startsWith: `RX${year}` } },
      orderBy: { prescriptionNo: 'desc' },
    })

    let prescriptionNo = `RX${year}0001`
    if (lastRx) {
      const lastNum = parseInt(lastRx.prescriptionNo.slice(-4))
      prescriptionNo = `RX${year}${(lastNum + 1).toString().padStart(4, '0')}`
    }

    // Get doctor's staff record
    const staff = await prisma.staff.findFirst({ where: { userId: session!.user!.id, hospitalId } })
    if (!staff) {
      return NextResponse.json({ error: 'Doctor staff record not found' }, { status: 400 })
    }

    const prescription = await prisma.prescription.create({
      data: {
        hospitalId,
        prescriptionNo,
        patientId,
        doctorId: staff.id,
        diagnosis: diagnosis || null,
        notes: notes || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        medications: {
          create: medications.map((m: any) => ({
            medicationId: m.medicationId || null,
            medicationName: m.medicationName,
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration,
            route: m.route || 'Oral',
            timing: m.timing || null,
            quantity: m.quantity || null,
            instructions: m.instructions || null,
          })),
        },
      },
      include: {
        patient: { select: { patientId: true, firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true } },
        medications: true,
      },
    })

    return NextResponse.json({ success: true, data: prescription }, { status: 201 })
  } catch (err: any) {
    console.error('Error creating prescription:', err)
    return NextResponse.json({ error: err.message || 'Failed to create prescription' }, { status: 500 })
  }
}
