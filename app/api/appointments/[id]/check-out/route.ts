import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// POST - Check out patient (complete appointment)
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
    const body = await request.json().catch(() => ({}))
    const { notes } = body

    const appointment = await prisma.appointment.findFirst({
      where: { id, hospitalId }
    })

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      )
    }

    // Validate appointment status for check-out
    if (!["CHECKED_IN", "IN_PROGRESS"].includes(appointment.status)) {
      return NextResponse.json(
        { error: `Cannot check out appointment with status: ${appointment.status}` },
        { status: 400 }
      )
    }

    const checkedOutAt = new Date()

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: "COMPLETED",
        checkedOutAt,
        notes: notes ? (appointment.notes ? `${appointment.notes}\n\n${notes}` : notes) : appointment.notes
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
    console.error("Error checking out appointment:", error)
    return NextResponse.json(
      { error: "Failed to check out" },
      { status: 500 }
    )
  }
}
