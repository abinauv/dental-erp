import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { createRoom } from "@/lib/services/video.service"

/**
 * GET /api/video/consultations
 * List video consultations for the hospital.
 * Filters: status, doctorId, patientId, date range
 */
export async function GET(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"))
  const status = searchParams.get("status")
  const doctorId = searchParams.get("doctorId")
  const patientId = searchParams.get("patientId")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const where: any = { hospitalId }
  if (status) where.status = status
  if (doctorId) where.doctorId = doctorId
  if (patientId) where.patientId = patientId
  if (from || to) {
    where.scheduledAt = {}
    if (from) where.scheduledAt.gte = new Date(from)
    if (to) where.scheduledAt.lte = new Date(to)
  }

  const [consultations, total] = await Promise.all([
    prisma.videoConsultation.findMany({
      where,
      include: {
        patient: { select: { id: true, patientId: true, firstName: true, lastName: true, phone: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialization: true } },
        appointment: { select: { id: true, appointmentNo: true, scheduledDate: true, scheduledTime: true } },
      },
      orderBy: { scheduledAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.videoConsultation.count({ where }),
  ])

  // Summary counts
  const [scheduled, inProgress, completed, cancelled] = await Promise.all([
    prisma.videoConsultation.count({ where: { hospitalId, status: "SCHEDULED" } }),
    prisma.videoConsultation.count({ where: { hospitalId, status: "IN_PROGRESS" } }),
    prisma.videoConsultation.count({ where: { hospitalId, status: "COMPLETED" } }),
    prisma.videoConsultation.count({ where: { hospitalId, status: "CANCELLED" } }),
  ])

  return NextResponse.json({
    consultations,
    total,
    totalPages: Math.ceil(total / limit),
    page,
    summary: { scheduled, inProgress, completed, cancelled },
  })
}

/**
 * POST /api/video/consultations
 * Create a new video consultation (optionally linked to an appointment).
 */
export async function POST(req: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
  if (error) return error

  const body = await req.json()
  const { appointmentId, patientId, doctorId, scheduledAt, notes } = body

  if (!patientId || !doctorId || !scheduledAt) {
    return NextResponse.json(
      { error: "patientId, doctorId, and scheduledAt are required" },
      { status: 400 }
    )
  }

  // Validate patient belongs to hospital
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, hospitalId },
  })
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 })
  }

  // Validate doctor belongs to hospital
  const doctor = await prisma.staff.findFirst({
    where: { id: doctorId, hospitalId },
  })
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 })
  }

  // If linked to appointment, validate it
  if (appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
    })
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    // Check no existing consultation for this appointment
    const existing = await prisma.videoConsultation.findUnique({
      where: { appointmentId },
    })
    if (existing) {
      return NextResponse.json(
        { error: "A video consultation already exists for this appointment" },
        { status: 409 }
      )
    }
  }

  // Create video room
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const room = await createRoom(tempId)

  const consultation = await prisma.videoConsultation.create({
    data: {
      hospitalId: hospitalId!,
      appointmentId: appointmentId || null,
      patientId,
      doctorId,
      roomUrl: room.roomUrl,
      roomName: room.roomName,
      scheduledAt: new Date(scheduledAt),
      notes: notes || null,
    },
    include: {
      patient: { select: { id: true, patientId: true, firstName: true, lastName: true } },
      doctor: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  // If linked to an appointment, mark it as virtual
  if (appointmentId) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { isVirtual: true, videoConsultationId: consultation.id },
    })
  }

  return NextResponse.json(consultation, { status: 201 })
}
