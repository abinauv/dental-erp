import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { createRoom, deleteRoom } from "@/lib/services/video.service"

/**
 * POST /api/video/room
 * Create a video room for a consultation.
 */
export async function POST(req: Request) {
  const { error } = await requireAuthAndRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
  if (error) return error

  const body = await req.json()
  const { consultationId } = body

  if (!consultationId) {
    return NextResponse.json({ error: "consultationId is required" }, { status: 400 })
  }

  const room = await createRoom(consultationId)
  return NextResponse.json(room, { status: 201 })
}

/**
 * DELETE /api/video/room
 * Delete/cleanup a video room.
 */
export async function DELETE(req: Request) {
  const { error } = await requireAuthAndRole(["ADMIN", "DOCTOR"])
  if (error) return error

  const { searchParams } = new URL(req.url)
  const roomName = searchParams.get("roomName")

  if (!roomName) {
    return NextResponse.json({ error: "roomName is required" }, { status: 400 })
  }

  await deleteRoom(roomName)
  return NextResponse.json({ success: true })
}
