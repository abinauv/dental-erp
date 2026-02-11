import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/sterilization/instruments/[id]
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR"])
  if (error) return error

  const { id } = await params

  const instrument = await prisma.instrument.findFirst({
    where: { id, hospitalId: hospitalId! },
    include: {
      sterilizationLogs: {
        orderBy: { startedAt: "desc" },
        take: 20,
      },
    },
  })

  if (!instrument) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 })
  }

  return NextResponse.json({ instrument })
}

/**
 * PUT /api/sterilization/instruments/[id]
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error) return error

  const { id } = await params
  const body = await req.json()

  const existing = await prisma.instrument.findFirst({
    where: { id, hospitalId: hospitalId! },
  })
  if (!existing) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}
  const fields = ["name", "category", "serialNumber", "rfidTag", "status", "location", "maxCycles", "notes"]
  for (const f of fields) {
    if (body[f] !== undefined) updateData[f] = body[f]
  }
  if (body.maxCycles !== undefined) updateData.maxCycles = body.maxCycles ? Number(body.maxCycles) : null
  if (body.purchaseDate !== undefined) updateData.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null
  if (body.warrantyDate !== undefined) updateData.warrantyDate = body.warrantyDate ? new Date(body.warrantyDate) : null

  const instrument = await prisma.instrument.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json({ instrument })
}

/**
 * DELETE /api/sterilization/instruments/[id]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error) return error

  const { id } = await params

  const existing = await prisma.instrument.findFirst({
    where: { id, hospitalId: hospitalId! },
  })
  if (!existing) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 })
  }

  await prisma.instrument.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
