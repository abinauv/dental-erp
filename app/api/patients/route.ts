import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole, checkPatientLimit } from "@/lib/api-helpers"

// Generate unique patient ID for the hospital
async function generatePatientId(hospitalId: string): Promise<string> {
  const today = new Date()
  const prefix = `PAT${today.getFullYear()}`

  const lastPatient = await prisma.patient.findFirst({
    where: {
      hospitalId,
      patientId: {
        startsWith: prefix
      }
    },
    orderBy: {
      patientId: 'desc'
    }
  })

  if (lastPatient) {
    const lastNumber = parseInt(lastPatient.patientId.slice(-5))
    return `${prefix}${String(lastNumber + 1).padStart(5, '0')}`
  }

  return `${prefix}00001`
}

// GET - List patients
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10") || 10))
    const search = searchParams.get("search") || ""
    const all = searchParams.get("all") === "true"

    const skip = (page - 1) * limit

    const where: any = {
      hospitalId,
      isActive: true
    }

    if (search) {
      where.OR = [
        { patientId: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        select: {
          id: true,
          patientId: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          gender: true,
          age: true,
          bloodGroup: true,
          city: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: all ? undefined : skip,
        take: all ? undefined : limit,
      }),
      prisma.patient.count({ where })
    ])

    return NextResponse.json({
      patients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching patients:", error)
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    )
  }
}

// POST - Create new patient
export async function POST(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check patient limit
    const patientLimit = await checkPatientLimit(hospitalId)
    if (!patientLimit.allowed) {
      return NextResponse.json(
        {
          error: "Patient limit reached",
          message: `Your plan allows up to ${patientLimit.max} patients. Please upgrade to add more.`,
          current: patientLimit.current,
          max: patientLimit.max,
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      dateOfBirth,
      age,
      gender,
      bloodGroup,
      phone,
      alternatePhone,
      email,
      address,
      city,
      state,
      pincode,
      aadharNumber,
      occupation,
      referredBy,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      medicalHistory,
    } = body

    // Validate required fields
    if (!firstName || !lastName || !phone) {
      return NextResponse.json(
        { error: "First name, last name, and phone are required" },
        { status: 400 }
      )
    }

    // Check for duplicate phone within this hospital
    const existingPatient = await prisma.patient.findFirst({
      where: { hospitalId, phone }
    })

    if (existingPatient) {
      return NextResponse.json(
        { error: "A patient with this phone number already exists" },
        { status: 409 }
      )
    }

    // Generate patient ID for this hospital
    const patientId = await generatePatientId(hospitalId)

    // Create patient with medical history
    const patient = await prisma.patient.create({
      data: {
        patientId,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        age,
        gender,
        bloodGroup,
        phone,
        alternatePhone,
        email,
        address,
        city,
        state,
        pincode,
        aadharNumber,
        occupation,
        referredBy,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        hospitalId,
        medicalHistory: medicalHistory ? {
          create: medicalHistory
        } : undefined
      },
      include: {
        medicalHistory: true
      }
    })

    return NextResponse.json(patient, { status: 201 })
  } catch (error) {
    console.error("Error creating patient:", error)
    return NextResponse.json(
      { error: "Failed to create patient" },
      { status: 500 }
    )
  }
}
