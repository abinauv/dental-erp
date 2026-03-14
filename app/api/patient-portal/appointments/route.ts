import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePatientAuth } from "@/lib/patient-auth"

/**
 * GET: List patient's appointments (past + upcoming).
 */
export async function GET(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get("filter") || "upcoming" // upcoming | past | all
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const where: Record<string, unknown> = {
      patientId: patient!.id,
      hospitalId: patient!.hospitalId,
    }

    if (filter === "upcoming") {
      where.scheduledDate = { gte: today }
      where.status = { in: ["SCHEDULED", "CONFIRMED"] }
    } else if (filter === "past") {
      where.OR = [
        { scheduledDate: { lt: today } },
        { status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] } },
      ]
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where: where as any,
        include: {
          doctor: {
            select: {
              firstName: true,
              lastName: true,
              specialization: true,
            },
          },
        },
        orderBy: { scheduledDate: filter === "upcoming" ? "asc" : "desc" },
        skip,
        take: limit,
      }),
      prisma.appointment.count({ where: where as any }),
    ])

    return NextResponse.json({
      appointments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err: unknown) {
    console.error("Patient appointments error:", err)
    return NextResponse.json(
      { error: "Failed to load appointments" },
      { status: 500 }
    )
  }
}

/**
 * POST: Patient requests a new appointment.
 * Body: { doctorId, date, time, type, chiefComplaint }
 */
export async function POST(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const body = await req.json()
    const { doctorId, date, time, type, chiefComplaint } = body as {
      doctorId: string
      date: string
      time: string
      type?: string
      chiefComplaint?: string
    }

    if (!doctorId || !date || !time) {
      return NextResponse.json(
        { error: "Doctor, date, and time are required" },
        { status: 400 }
      )
    }

    // Verify doctor belongs to hospital
    const doctor = await prisma.staff.findFirst({
      where: { id: doctorId, hospitalId: patient!.hospitalId },
    })

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 })
    }

    // Generate appointment number
    const lastAppt = await prisma.appointment.findFirst({
      where: { hospitalId: patient!.hospitalId },
      orderBy: { createdAt: "desc" },
      select: { appointmentNo: true },
    })
    const lastNum = lastAppt
      ? parseInt(lastAppt.appointmentNo.replace(/\D/g, "")) || 0
      : 0
    const appointmentNo = `APT${String(lastNum + 1).padStart(5, "0")}`

    const appointment = await prisma.appointment.create({
      data: {
        hospitalId: patient!.hospitalId,
        appointmentNo,
        patientId: patient!.id,
        doctorId,
        scheduledDate: new Date(date),
        scheduledTime: time,
        appointmentType: (type as any) || "CONSULTATION",
        status: "SCHEDULED",
        chiefComplaint: chiefComplaint || null,
      },
      include: {
        doctor: {
          select: { firstName: true, lastName: true, specialization: true },
        },
      },
    })

    return NextResponse.json({ success: true, appointment }, { status: 201 })
  } catch (err: unknown) {
    console.error("Patient book appointment error:", err)
    return NextResponse.json(
      { error: "Failed to book appointment" },
      { status: 500 }
    )
  }
}
