import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// POST - Complete treatment
export async function POST(
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
        { error: "You don't have permission to complete treatments" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Check if treatment exists
    const treatment = await prisma.treatment.findUnique({
      where: { id, hospitalId }
    })

    if (!treatment) {
      return NextResponse.json(
        { error: "Treatment not found" },
        { status: 404 }
      )
    }

    // Check if treatment can be completed
    if (treatment.status !== "IN_PROGRESS" && treatment.status !== "PLANNED") {
      return NextResponse.json(
        { error: `Cannot complete treatment with status: ${treatment.status}` },
        { status: 400 }
      )
    }

    // Update treatment with completion details
    const updateData: any = {
      status: "COMPLETED",
      endTime: new Date()
    }

    // If treatment was never started, set start time to now
    if (!treatment.startTime) {
      updateData.startTime = new Date()
    }

    // Optional completion notes
    if (body.procedureNotes !== undefined) updateData.procedureNotes = body.procedureNotes
    if (body.materialsUsed !== undefined) updateData.materialsUsed = body.materialsUsed
    if (body.complications !== undefined) updateData.complications = body.complications
    if (body.followUpRequired !== undefined) updateData.followUpRequired = body.followUpRequired
    if (body.followUpDate !== undefined) updateData.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null

    const updatedTreatment = await prisma.treatment.update({
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

    return NextResponse.json(updatedTreatment)
  } catch (error) {
    console.error("Error completing treatment:", error)
    return NextResponse.json(
      { error: "Failed to complete treatment" },
      { status: 500 }
    )
  }
}
