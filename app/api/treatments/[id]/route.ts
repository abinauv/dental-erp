import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get single treatment with all details
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

    const treatment = await prisma.treatment.findUnique({
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
            bloodGroup: true,
          }
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true,
            phone: true,
          }
        },
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
        },
        appointment: {
          select: {
            id: true,
            appointmentNo: true,
            scheduledDate: true,
            scheduledTime: true,
            status: true,
          }
        },
        invoiceItems: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNo: true,
                status: true,
                totalAmount: true,
              }
            }
          }
        }
      }
    })

    if (!treatment) {
      return NextResponse.json(
        { error: "Treatment not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(treatment)
  } catch (error) {
    console.error("Error fetching treatment:", error)
    return NextResponse.json(
      { error: "Failed to fetch treatment" },
      { status: 500 }
    )
  }
}

// PUT - Update treatment
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
        { error: "You don't have permission to update treatments" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Check if treatment exists
    const existingTreatment = await prisma.treatment.findUnique({
      where: { id, hospitalId }
    })

    if (!existingTreatment) {
      return NextResponse.json(
        { error: "Treatment not found" },
        { status: 404 }
      )
    }

    // Prevent updates to completed or cancelled treatments (except by admin)
    if (
      (existingTreatment.status === "COMPLETED" || existingTreatment.status === "CANCELLED") &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Cannot modify completed or cancelled treatments" },
        { status: 400 }
      )
    }

    const updateData: any = {}

    // Only update fields that are provided
    if (body.toothNumbers !== undefined) updateData.toothNumbers = body.toothNumbers
    if (body.chiefComplaint !== undefined) updateData.chiefComplaint = body.chiefComplaint
    if (body.diagnosis !== undefined) updateData.diagnosis = body.diagnosis
    if (body.findings !== undefined) updateData.findings = body.findings
    if (body.procedureNotes !== undefined) updateData.procedureNotes = body.procedureNotes
    if (body.materialsUsed !== undefined) updateData.materialsUsed = body.materialsUsed
    if (body.complications !== undefined) updateData.complications = body.complications
    if (body.followUpRequired !== undefined) updateData.followUpRequired = body.followUpRequired
    if (body.followUpDate !== undefined) updateData.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null
    if (body.cost !== undefined) updateData.cost = body.cost

    // Handle status changes
    if (body.status !== undefined) {
      updateData.status = body.status

      // Set start time when treatment begins
      if (body.status === "IN_PROGRESS" && !existingTreatment.startTime) {
        updateData.startTime = new Date()
      }

      // Set end time when treatment completes
      if (body.status === "COMPLETED" && !existingTreatment.endTime) {
        updateData.endTime = new Date()
      }
    }

    const treatment = await prisma.treatment.update({
      where: { id, hospitalId },
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
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        procedure: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
          }
        }
      }
    })

    return NextResponse.json(treatment)
  } catch (error) {
    console.error("Error updating treatment:", error)
    return NextResponse.json(
      { error: "Failed to update treatment" },
      { status: 500 }
    )
  }
}

// DELETE - Delete treatment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Only admin can delete treatments
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can delete treatments" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if treatment exists
    const treatment = await prisma.treatment.findUnique({
      where: { id, hospitalId },
      include: {
        invoiceItems: true,
      }
    })

    if (!treatment) {
      return NextResponse.json(
        { error: "Treatment not found" },
        { status: 404 }
      )
    }

    // Check if treatment has invoices
    if (treatment.invoiceItems.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete treatment with linked invoices" },
        { status: 400 }
      )
    }

    // Delete treatment
    await prisma.treatment.delete({
      where: { id, hospitalId }
    })

    return NextResponse.json({
      message: "Treatment deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting treatment:", error)
    return NextResponse.json(
      { error: "Failed to delete treatment" },
      { status: 500 }
    )
  }
}
