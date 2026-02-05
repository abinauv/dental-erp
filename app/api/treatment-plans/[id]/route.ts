import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get single treatment plan with all details
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

    const treatmentPlan = await prisma.treatmentPlan.findFirst({
      where: { id, hospitalId },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            dateOfBirth: true,
            gender: true,
          }
        },
        items: {
          include: {
            procedure: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                description: true,
                defaultDuration: true,
                basePrice: true,
                preInstructions: true,
                postInstructions: true,
              }
            }
          },
          orderBy: {
            priority: 'asc'
          }
        }
      }
    })

    if (!treatmentPlan) {
      return NextResponse.json(
        { error: "Treatment plan not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(treatmentPlan)
  } catch (error) {
    console.error("Error fetching treatment plan:", error)
    return NextResponse.json(
      { error: "Failed to fetch treatment plan" },
      { status: 500 }
    )
  }
}

// PUT - Update treatment plan
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
    if (!["ADMIN", "DOCTOR"].includes(session?.user?.role || "")) {
      return NextResponse.json(
        { error: "You don't have permission to update treatment plans" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Check if treatment plan exists and belongs to this hospital
    const existingPlan = await prisma.treatmentPlan.findFirst({
      where: { id, hospitalId },
      include: { items: true }
    })

    if (!existingPlan) {
      return NextResponse.json(
        { error: "Treatment plan not found" },
        { status: 404 }
      )
    }

    // Prevent updates to completed or cancelled plans (except by admin)
    if (
      (existingPlan.status === "COMPLETED" || existingPlan.status === "CANCELLED") &&
      session?.user?.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Cannot modify completed or cancelled treatment plans" },
        { status: 400 }
      )
    }

    const updateData: any = {}

    // Update basic fields
    if (body.title !== undefined) updateData.title = body.title
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.status !== undefined) updateData.status = body.status
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.expectedEndDate !== undefined) updateData.expectedEndDate = body.expectedEndDate ? new Date(body.expectedEndDate) : null
    if (body.consentGiven !== undefined) updateData.consentGiven = body.consentGiven

    // Handle completion
    if (body.status === "COMPLETED" && !existingPlan.completedDate) {
      updateData.completedDate = new Date()
    }

    // Update items if provided
    if (body.items !== undefined) {
      // Delete existing items
      await prisma.treatmentPlanItem.deleteMany({
        where: { treatmentPlanId: id }
      })

      // Calculate new estimated cost and duration
      let estimatedCost = 0
      let estimatedDuration = 0

      if (body.items.length > 0) {
        const procedures = await prisma.procedure.findMany({
          where: {
            id: { in: body.items.map((item: any) => item.procedureId) },
            hospitalId
          }
        })

        const procedureMap = new Map(procedures.map(p => [p.id, p]))

        body.items.forEach((item: any) => {
          const proc = procedureMap.get(item.procedureId)
          if (proc) {
            estimatedCost += item.estimatedCost || Number(proc.basePrice)
            estimatedDuration += proc.defaultDuration
          }
        })
      }

      updateData.estimatedCost = estimatedCost
      updateData.estimatedDuration = estimatedDuration

      // Create new items
      await prisma.treatmentPlanItem.createMany({
        data: body.items.map((item: any, index: number) => ({
          treatmentPlanId: id,
          procedureId: item.procedureId,
          toothNumbers: item.toothNumbers || null,
          priority: item.priority || index + 1,
          estimatedCost: item.estimatedCost || 0,
          notes: item.notes || null,
          status: item.status || "PENDING",
        }))
      })
    }

    const treatmentPlan = await prisma.treatmentPlan.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
          }
        },
        items: {
          include: {
            procedure: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                basePrice: true,
              }
            }
          },
          orderBy: {
            priority: 'asc'
          }
        }
      }
    })

    return NextResponse.json(treatmentPlan)
  } catch (error) {
    console.error("Error updating treatment plan:", error)
    return NextResponse.json(
      { error: "Failed to update treatment plan" },
      { status: 500 }
    )
  }
}

// DELETE - Delete treatment plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Only admin can delete treatment plans
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can delete treatment plans" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if treatment plan exists and belongs to this hospital
    const treatmentPlan = await prisma.treatmentPlan.findFirst({
      where: { id, hospitalId },
      include: {
        items: true
      }
    })

    if (!treatmentPlan) {
      return NextResponse.json(
        { error: "Treatment plan not found" },
        { status: 404 }
      )
    }

    // Check if any items are in progress or completed
    const hasActiveItems = treatmentPlan.items.some(
      item => item.status === "IN_PROGRESS" || item.status === "COMPLETED"
    )

    if (hasActiveItems) {
      return NextResponse.json(
        { error: "Cannot delete treatment plan with active or completed items" },
        { status: 400 }
      )
    }

    // Delete items first
    await prisma.treatmentPlanItem.deleteMany({
      where: { treatmentPlanId: id }
    })

    // Delete treatment plan
    await prisma.treatmentPlan.delete({
      where: { id }
    })

    return NextResponse.json({
      message: "Treatment plan deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting treatment plan:", error)
    return NextResponse.json(
      { error: "Failed to delete treatment plan" },
      { status: 500 }
    )
  }
}
