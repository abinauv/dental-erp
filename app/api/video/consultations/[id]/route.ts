import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { deleteRoom } from "@/lib/services/video.service"

/**
 * GET /api/video/consultations/[id]
 * Get a single video consultation with full details.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error) return error

  const { id } = await params

  const consultation = await prisma.videoConsultation.findFirst({
    where: { id, hospitalId },
    include: {
      patient: {
        select: {
          id: true,
          patientId: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          dateOfBirth: true,
          gender: true,
          medicalHistory: {
            select: {
              hasAllergies: true,
              drugAllergies: true,
              hasDiabetes: true,
              hasHypertension: true,
              hasHeartDisease: true,
            },
          },
        },
      },
      doctor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          specialization: true,
          phone: true,
        },
      },
      appointment: {
        select: {
          id: true,
          appointmentNo: true,
          scheduledDate: true,
          scheduledTime: true,
          appointmentType: true,
          chiefComplaint: true,
        },
      },
    },
  })

  if (!consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 })
  }

  return NextResponse.json(consultation)
}

/**
 * PUT /api/video/consultations/[id]
 * Update consultation: start, end, cancel, add notes.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const { action, notes } = body

  const consultation = await prisma.videoConsultation.findFirst({
    where: { id, hospitalId },
  })

  if (!consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 })
  }

  const data: any = {}

  switch (action) {
    case "start": {
      if (consultation.status !== "SCHEDULED") {
        return NextResponse.json({ error: "Can only start a SCHEDULED consultation" }, { status: 400 })
      }
      data.status = "IN_PROGRESS"
      data.startedAt = new Date()

      // Update linked appointment status
      if (consultation.appointmentId) {
        await prisma.appointment.update({
          where: { id: consultation.appointmentId },
          data: { status: "IN_PROGRESS" },
        })
      }
      break
    }
    case "end": {
      if (consultation.status !== "IN_PROGRESS") {
        return NextResponse.json({ error: "Can only end an IN_PROGRESS consultation" }, { status: 400 })
      }
      const startedAt = consultation.startedAt || new Date()
      const duration = Math.round((Date.now() - startedAt.getTime()) / 60000)

      data.status = "COMPLETED"
      data.endedAt = new Date()
      data.duration = duration
      if (notes) data.notes = notes

      // Update linked appointment status
      if (consultation.appointmentId) {
        await prisma.appointment.update({
          where: { id: consultation.appointmentId },
          data: { status: "COMPLETED", checkedOutAt: new Date() },
        })
      }

      // Cleanup video room
      await deleteRoom(consultation.roomName)
      break
    }
    case "cancel": {
      if (consultation.status === "COMPLETED") {
        return NextResponse.json({ error: "Cannot cancel a completed consultation" }, { status: 400 })
      }
      data.status = "CANCELLED"

      // Update linked appointment
      if (consultation.appointmentId) {
        await prisma.appointment.update({
          where: { id: consultation.appointmentId },
          data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: "Video consultation cancelled" },
        })
      }

      await deleteRoom(consultation.roomName)
      break
    }
    case "no_show": {
      if (consultation.status !== "SCHEDULED") {
        return NextResponse.json({ error: "Can only mark SCHEDULED consultation as no-show" }, { status: 400 })
      }
      data.status = "NO_SHOW"

      if (consultation.appointmentId) {
        await prisma.appointment.update({
          where: { id: consultation.appointmentId },
          data: { status: "NO_SHOW" },
        })
      }

      await deleteRoom(consultation.roomName)
      break
    }
    case "update_notes": {
      if (notes !== undefined) data.notes = notes
      break
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const updated = await prisma.videoConsultation.update({
    where: { id },
    data,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      doctor: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  return NextResponse.json(updated)
}
