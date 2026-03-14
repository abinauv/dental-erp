import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/sterilization/instruments
 * List instruments with optional filters
 */
export async function GET(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR"])
  if (error) return error

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const category = searchParams.get("category")
  const search = searchParams.get("search")

  const where: Record<string, unknown> = { hospitalId: hospitalId! }
  if (status) where.status = status
  if (category) where.category = category
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { serialNumber: { contains: search } },
      { rfidTag: { contains: search } },
    ]
  }

  const instruments = await prisma.instrument.findMany({
    where,
    include: {
      _count: { select: { sterilizationLogs: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json({ instruments })
}

/**
 * POST /api/sterilization/instruments
 * Create a new instrument
 */
export async function POST(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error) return error

  const body = await req.json()
  const { name, category, serialNumber, rfidTag, location, maxCycles, purchaseDate, warrantyDate, notes } = body

  if (!name || !category) {
    return NextResponse.json({ error: "Name and category are required" }, { status: 400 })
  }

  const instrument = await prisma.instrument.create({
    data: {
      hospitalId: hospitalId!,
      name,
      category,
      serialNumber: serialNumber || null,
      rfidTag: rfidTag || null,
      location: location || null,
      maxCycles: maxCycles ? Number(maxCycles) : null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      warrantyDate: warrantyDate ? new Date(warrantyDate) : null,
      notes: notes || null,
    },
  })

  return NextResponse.json({ instrument }, { status: 201 })
}
