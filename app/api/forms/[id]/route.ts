import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET: Single submission detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const submission = await prisma.formSubmission.findFirst({
      where: { id, hospitalId },
      include: {
        template: true,
      },
    })

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    return NextResponse.json({ submission })
  } catch (err) {
    console.error("Get submission error:", err)
    return NextResponse.json({ error: "Failed to get submission" }, { status: 500 })
  }
}

// PUT: Review/approve/reject a submission
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, hospitalId, session } = await requireAuthAndRole(["ADMIN", "DOCTOR"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const existing = await prisma.formSubmission.findFirst({
      where: { id, hospitalId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    const body = await req.json()
    const { status, reviewNotes } = body

    if (!["REVIEWED", "APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const submission = await prisma.formSubmission.update({
      where: { id },
      data: {
        status,
        reviewedBy: session?.user?.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
    })

    return NextResponse.json({ submission })
  } catch (err) {
    console.error("Review submission error:", err)
    return NextResponse.json({ error: "Failed to update submission" }, { status: 500 })
  }
}
