import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// POST - Check in patient for appointment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const appointment = await prisma.appointment.findFirst({
      where: { id, hospitalId }
    })

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      )
    }

    // Validate appointment status for check-in
    if (!["SCHEDULED", "CONFIRMED"].includes(appointment.status)) {
      return NextResponse.json(
        { error: `Cannot check in appointment with status: ${appointment.status}` },
        { status: 400 }
      )
    }

    const checkedInAt = new Date()

    // Calculate wait time from scheduled time
    const scheduledDateTime = new Date(appointment.scheduledDate)
    const [hours, minutes] = appointment.scheduledTime.split(':').map(Number)
    scheduledDateTime.setHours(hours, minutes, 0, 0)

    const waitTime = checkedInAt > scheduledDateTime
      ? Math.round((checkedInAt.getTime() - scheduledDateTime.getTime()) / 60000)
      : 0

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CHECKED_IN",
        checkedInAt,
        waitTime
      },
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
          }
        }
      }
    })

    return NextResponse.json(updatedAppointment)
  } catch (error) {
    console.error("Error checking in appointment:", error)
    return NextResponse.json(
      { error: "Failed to check in" },
      { status: 500 }
    )
  }
}
