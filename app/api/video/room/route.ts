import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { createRoom, deleteRoom } from '@/lib/services/video.service'

/**
 * POST /api/video/room
 * Create a video room for a consultation.
 */
export async function POST(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error) return error

  const body = await req.json()
  const { consultationId } = body

  if (!consultationId) {
    return NextResponse.json({ error: 'consultationId is required' }, { status: 400 })
  }

  const consultation = await prisma.videoConsultation.findFirst({
    where: { id: consultationId, hospitalId },
    select: { id: true },
  })
  if (!consultation) {
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })
  }

  const room = await createRoom(consultation.id)
  return NextResponse.json(room, { status: 201 })
}

/**
 * DELETE /api/video/room
 * Delete/cleanup a video room.
 */
export async function DELETE(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error) return error

  const { searchParams } = new URL(req.url)
  const roomName = searchParams.get('roomName')

  if (!roomName) {
    return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
  }

  // Only rooms that belong to one of this hospital's consultations.
  const consultation = await prisma.videoConsultation.findFirst({
    where: { roomName, hospitalId },
    select: { roomName: true },
  })
  if (!consultation) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  await deleteRoom(consultation.roomName)
  return NextResponse.json({ success: true })
}
