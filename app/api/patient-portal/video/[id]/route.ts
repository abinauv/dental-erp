import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePatientAuth } from "@/lib/patient-auth"
import { getRoomToken, getVideoProvider } from "@/lib/services/video.service"

/**
 * GET /api/patient-portal/video/[id]
 * Get video consultation details and join token for a patient.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  const { id } = await params

  const consultation = await prisma.videoConsultation.findFirst({
    where: {
      id,
      patientId: patient!.id,
      hospitalId: patient!.hospitalId,
    },
    include: {
      doctor: { select: { firstName: true, lastName: true, specialization: true } },
      appointment: { select: { appointmentNo: true, scheduledDate: true, scheduledTime: true, chiefComplaint: true } },
    },
  })

  if (!consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 })
  }

  const provider = getVideoProvider()
  const participantName = `${patient!.firstName} ${patient!.lastName}`

  let token: string | null = null
  if (provider === "daily") {
    token = await getRoomToken(consultation.roomName, participantName, false)
  }

  return NextResponse.json({
    consultation,
    token,
    roomUrl: consultation.roomUrl,
    roomName: consultation.roomName,
    provider,
    participantName,
  })
}
