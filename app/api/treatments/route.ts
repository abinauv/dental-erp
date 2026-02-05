import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// Generate unique treatment number
async function generateTreatmentNo(hospitalId: string): Promise<string> {
  const today = new Date()
  const prefix = `TRT${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`

  const lastTreatment = await prisma.treatment.findFirst({
    where: {
      hospitalId,
      treatmentNo: {
        startsWith: prefix
      }
    },
    orderBy: {
      treatmentNo: 'desc'
    }
  })

  if (lastTreatment) {
    const lastNumber = parseInt(lastTreatment.treatmentNo.slice(-4))
    return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`
  }

  return `${prefix}0001`
}

// GET - List treatments with filters
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const patientId = searchParams.get("patientId") || ""
    const doctorId = searchParams.get("doctorId") || ""
    const procedureId = searchParams.get("procedureId") || ""
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""
    const followUpRequired = searchParams.get("followUpRequired")

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { hospitalId }

    if (search) {
      where.OR = [
        { treatmentNo: { contains: search } },
        { chiefComplaint: { contains: search } },
        { diagnosis: { contains: search } },
        { patient: { firstName: { contains: search } } },
        { patient: { lastName: { contains: search } } },
        { patient: { patientId: { contains: search } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (patientId) {
      where.patientId = patientId
    }

    if (doctorId) {
      where.doctorId = doctorId
    }

    if (procedureId) {
      where.procedureId = procedureId
    }

    if (followUpRequired === "true") {
      where.followUpRequired = true
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = endDate
      }
    }

    const [treatments, total] = await Promise.all([
      prisma.treatment.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              firstName: true,
              lastName: true,
              phone: true,
            }
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              specialization: true,
            }
          },
          procedure: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
            }
          },
          appointment: {
            select: {
              id: true,
              appointmentNo: true,
              scheduledDate: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.treatment.count({ where })
    ])

    return NextResponse.json({
      treatments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching treatments:", error)
    return NextResponse.json(
      { error: "Failed to fetch treatments" },
      { status: 500 }
    )
  }
}

// POST - Create new treatment
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN", "DOCTOR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to create treatments" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      patientId,
      appointmentId,
      procedureId,
      doctorId,
      toothNumbers,
      chiefComplaint,
      diagnosis,
      findings,
      procedureNotes,
      materialsUsed,
      complications,
      followUpRequired = false,
      followUpDate,
      cost,
    } = body

    // Validate required fields
    if (!patientId || !procedureId || !doctorId) {
      return NextResponse.json(
        { error: "Patient, procedure, and doctor are required" },
        { status: 400 }
      )
    }

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId, hospitalId }
    })
    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      )
    }

    // Check if doctor exists
    const doctor = await prisma.staff.findUnique({
      where: { id: doctorId, hospitalId }
    })
    if (!doctor) {
      return NextResponse.json(
        { error: "Doctor not found" },
        { status: 404 }
      )
    }

    // Check if procedure exists
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId, hospitalId }
    })
    if (!procedure) {
      return NextResponse.json(
        { error: "Procedure not found" },
        { status: 404 }
      )
    }

    // Check if appointment exists (if provided)
    if (appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId, hospitalId }
      })
      if (!appointment) {
        return NextResponse.json(
          { error: "Appointment not found" },
          { status: 404 }
        )
      }
    }

    // Generate treatment number
    const treatmentNo = await generateTreatmentNo(hospitalId)

    // Create treatment
    const treatment = await prisma.treatment.create({
      data: {
        hospitalId,
        treatmentNo,
        patientId,
        appointmentId,
        procedureId,
        doctorId,
        toothNumbers: toothNumbers || null,
        chiefComplaint,
        diagnosis,
        findings,
        procedureNotes,
        materialsUsed,
        complications,
        followUpRequired,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        cost: cost || procedure.basePrice,
        status: "PLANNED",
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
          }
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        procedure: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
          }
        }
      }
    })

    return NextResponse.json(treatment, { status: 201 })
  } catch (error) {
    console.error("Error creating treatment:", error)
    return NextResponse.json(
      { error: "Failed to create treatment" },
      { status: 500 }
    )
  }
}
