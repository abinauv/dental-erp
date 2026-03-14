import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// POST - Start treatment
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
        { error: "You don't have permission to start treatments" },
        { status: 403 }
      )
    }

    const { id } = await params

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

    // Check if treatment can be started
    if (treatment.status !== "PLANNED") {
      return NextResponse.json(
        { error: `Cannot start treatment with status: ${treatment.status}` },
        { status: 400 }
      )
    }

    // Update treatment status
    const updatedTreatment = await prisma.treatment.update({
      where: { id, hospitalId },
      data: {
        status: "IN_PROGRESS",
        startTime: new Date()
      },
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
          }
        }
      }
    })

    return NextResponse.json(updatedTreatment)
  } catch (error) {
    console.error("Error starting treatment:", error)
    return NextResponse.json(
      { error: "Failed to start treatment" },
      { status: 500 }
    )
  }
}
