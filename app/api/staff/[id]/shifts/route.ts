import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get staff member's shifts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const { id } = await params

    // Verify staff belongs to hospital
    const staffMember = await prisma.staff.findFirst({
      where: { id, hospitalId }
    })
    if (!staffMember) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    const shifts = await prisma.staffShift.findMany({
      where: { staffId: id },
      orderBy: { dayOfWeek: 'asc' }
    })

    return NextResponse.json({ shifts })
  } catch (error) {
    console.error("Error fetching shifts:", error)
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 }
    )
  }
}

// PUT - Update staff member's shifts (replace all)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    // Only admin can update shifts
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { shifts } = body

    // Verify staff belongs to hospital
    const staffMember = await prisma.staff.findFirst({
      where: { id, hospitalId }
    })
    if (!staffMember) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    if (!Array.isArray(shifts)) {
      return NextResponse.json(
        { error: "shifts must be an array" },
        { status: 400 }
      )
    }

    // Validate shifts
    for (const shift of shifts) {
      if (shift.dayOfWeek < 0 || shift.dayOfWeek > 6) {
        return NextResponse.json(
          { error: "dayOfWeek must be between 0 (Sunday) and 6 (Saturday)" },
          { status: 400 }
        )
      }
      if (!shift.startTime || !shift.endTime) {
        return NextResponse.json(
          { error: "Each shift must have startTime and endTime" },
          { status: 400 }
        )
      }
    }

    // Delete existing shifts and create new ones in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete all existing shifts for this staff
      await tx.staffShift.deleteMany({
        where: { staffId: id }
      })

      // Create new shifts
      if (shifts.length > 0) {
        await tx.staffShift.createMany({
          data: shifts.map((shift: any) => ({
            hospitalId,
            staffId: id,
            dayOfWeek: shift.dayOfWeek,
            startTime: shift.startTime,
            endTime: shift.endTime,
            isActive: shift.isActive !== false
          }))
        })
      }

      // Fetch and return the new shifts
      return await tx.staffShift.findMany({
        where: { staffId: id },
        orderBy: { dayOfWeek: 'asc' }
      })
    })

    return NextResponse.json({ shifts: result })
  } catch (error) {
    console.error("Error updating shifts:", error)
    return NextResponse.json(
      { error: "Failed to update shifts" },
      { status: 500 }
    )
  }
}
