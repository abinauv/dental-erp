import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get single procedure
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const procedure = await prisma.procedure.findUnique({
      where: { id, hospitalId },
      include: {
        _count: {
          select: {
            treatments: true,
            treatmentPlanItems: true,
          }
        }
      }
    })

    if (!procedure) {
      return NextResponse.json(
        { error: "Procedure not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(procedure)
  } catch (error) {
    console.error("Error fetching procedure:", error)
    return NextResponse.json(
      { error: "Failed to fetch procedure" },
      { status: 500 }
    )
  }
}

// PUT - Update procedure
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN", "DOCTOR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to update procedures" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Check if procedure exists
    const existingProcedure = await prisma.procedure.findUnique({
      where: { id, hospitalId }
    })

    if (!existingProcedure) {
      return NextResponse.json(
        { error: "Procedure not found" },
        { status: 404 }
      )
    }

    // Check if name is being changed and if new name already exists
    if (body.name && body.name !== existingProcedure.name) {
      const nameExists = await prisma.procedure.findFirst({
        where: {
          hospitalId,
          name: body.name,
          id: { not: id }
        }
      })

      if (nameExists) {
        return NextResponse.json(
          { error: "A procedure with this name already exists" },
          { status: 409 }
        )
      }
    }

    const updateData: any = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.defaultDuration !== undefined) updateData.defaultDuration = body.defaultDuration
    if (body.basePrice !== undefined) updateData.basePrice = body.basePrice
    if (body.materials !== undefined) updateData.materials = body.materials
    if (body.preInstructions !== undefined) updateData.preInstructions = body.preInstructions
    if (body.postInstructions !== undefined) updateData.postInstructions = body.postInstructions
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    const procedure = await prisma.procedure.update({
      where: { id, hospitalId },
      data: updateData
    })

    return NextResponse.json(procedure)
  } catch (error) {
    console.error("Error updating procedure:", error)
    return NextResponse.json(
      { error: "Failed to update procedure" },
      { status: 500 }
    )
  }
}

// DELETE - Delete procedure (soft delete by setting isActive to false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can delete procedures" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if procedure exists
    const procedure = await prisma.procedure.findUnique({
      where: { id, hospitalId },
      include: {
        _count: {
          select: {
            treatments: true,
            treatmentPlanItems: true,
          }
        }
      }
    })

    if (!procedure) {
      return NextResponse.json(
        { error: "Procedure not found" },
        { status: 404 }
      )
    }

    // Check if procedure is used in treatments or treatment plans
    if (procedure._count.treatments > 0 || procedure._count.treatmentPlanItems > 0) {
      // Soft delete - just mark as inactive
      await prisma.procedure.update({
        where: { id, hospitalId },
        data: { isActive: false }
      })

      return NextResponse.json({
        message: "Procedure has been deactivated as it is used in existing treatments",
        deactivated: true
      })
    }

    // Hard delete if not used
    await prisma.procedure.delete({
      where: { id, hospitalId }
    })

    return NextResponse.json({
      message: "Procedure deleted successfully",
      deleted: true
    })
  } catch (error) {
    console.error("Error deleting procedure:", error)
    return NextResponse.json(
      { error: "Failed to delete procedure" },
      { status: 500 }
    )
  }
}
