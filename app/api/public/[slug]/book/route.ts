import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST: Public booking endpoint.
 * Requires patient phone verification (patient must exist).
 * Body: { phone, doctorId, date, time, type, chiefComplaint }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await req.json()
    const { phone, doctorId, date, time, type, chiefComplaint } = body as {
      phone: string
      doctorId: string
      date: string
      time: string
      type?: string
      chiefComplaint?: string
    }

    if (!phone || !doctorId || !date || !time) {
      return NextResponse.json(
        { error: "Phone, doctor, date, and time are required" },
        { status: 400 }
      )
    }

    const hospital = await prisma.hospital.findUnique({
      where: { slug },
      select: { id: true, patientPortalEnabled: true },
    })

    if (!hospital) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 })
    }

    if (!hospital.patientPortalEnabled) {
      return NextResponse.json(
        { error: "Online booking is not enabled" },
        { status: 403 }
      )
    }

    // Find patient by phone
    const patient = await prisma.patient.findFirst({
      where: { hospitalId: hospital.id, phone, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!patient) {
      return NextResponse.json(
        { error: "No patient account found with this phone number. Please contact the clinic." },
        { status: 404 }
      )
    }

    // Verify doctor
    const doctor = await prisma.staff.findFirst({
      where: { id: doctorId, hospitalId: hospital.id },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 })
    }

    // Check for duplicate booking
    const dateObj = new Date(date)
    const existing = await prisma.appointment.findFirst({
      where: {
        hospitalId: hospital.id,
        patientId: patient.id,
        doctorId,
        scheduledDate: dateObj,
        scheduledTime: time,
        status: { notIn: ["CANCELLED", "NO_SHOW", "RESCHEDULED"] },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "You already have a booking at this time" },
        { status: 409 }
      )
    }

    // Generate appointment number
    const lastAppt = await prisma.appointment.findFirst({
      where: { hospitalId: hospital.id },
      orderBy: { createdAt: "desc" },
      select: { appointmentNo: true },
    })
    const lastNum = lastAppt
      ? parseInt(lastAppt.appointmentNo.replace(/\D/g, "")) || 0
      : 0
    const appointmentNo = `APT${String(lastNum + 1).padStart(5, "0")}`

    const appointment = await prisma.appointment.create({
      data: {
        hospitalId: hospital.id,
        appointmentNo,
        patientId: patient.id,
        doctorId,
        scheduledDate: dateObj,
        scheduledTime: time,
        appointmentType: (type as any) || "CONSULTATION",
        status: "SCHEDULED",
        chiefComplaint: chiefComplaint || null,
      },
    })

    return NextResponse.json(
      {
        success: true,
        appointment: {
          appointmentNo: appointment.appointmentNo,
          date: appointment.scheduledDate,
          time: appointment.scheduledTime,
          doctor: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        },
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    console.error("Public booking error:", err)
    return NextResponse.json(
      { error: "Failed to book appointment" },
      { status: 500 }
    )
  }
}
