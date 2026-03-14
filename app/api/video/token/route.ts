import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { getRoomToken, getVideoProvider } from "@/lib/services/video.service"

/**
 * GET /api/video/token?consultationId=xxx
 * Generate a join token for a video consultation participant.
 * Doctors get owner tokens; others get participant tokens.
 */
export async function GET(req: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const consultationId = searchParams.get("consultationId")

  if (!consultationId) {
    return NextResponse.json({ error: "consultationId is required" }, { status: 400 })
  }

  const consultation = await prisma.videoConsultation.findFirst({
    where: { id: consultationId, hospitalId },
    include: {
      doctor: { select: { userId: true, firstName: true, lastName: true } },
      patient: { select: { firstName: true, lastName: true } },
    },
  })

  if (!consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 })
  }

  const isDoctor = consultation.doctor.userId === user!.id
  const participantName = isDoctor
    ? `Dr. ${consultation.doctor.firstName} ${consultation.doctor.lastName}`
    : `${user!.name || "Participant"}`

  const provider = getVideoProvider()

  if (provider === "daily") {
    const token = await getRoomToken(consultation.roomName, participantName, isDoctor)
    return NextResponse.json({
      token,
      roomUrl: consultation.roomUrl,
      roomName: consultation.roomName,
      provider: "daily",
      isDoctor,
    })
  }

  // Jitsi — no token needed, just return the room URL
  return NextResponse.json({
    token: null,
    roomUrl: consultation.roomUrl,
    roomName: consultation.roomName,
    provider: "jitsi",
    isDoctor,
    participantName,
  })
}
